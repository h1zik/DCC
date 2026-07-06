"use server";

import {
  FinanceApArDocStatus,
  FinanceJournalLineLinkMode,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { FINANCE_BASE_CURRENCY, toDecimal, zeroDecimal } from "@/lib/finance-money";
import { ensurePeriodOpen } from "@/lib/finance-period-lock";
import { nextJournalNumber } from "@/lib/finance-journal-number";
import {
  createPostedEntryInTx,
  lockApBillForUpdate,
  lockArInvoiceForUpdate,
} from "@/lib/finance-journal-post";
import { logFinanceAudit } from "@/lib/finance-audit";
import { FinanceAuditAction } from "@prisma/client";

function journalPaths() {
  revalidatePath("/finance/journals");
  revalidatePath("/finance/general-ledger");
  revalidatePath("/finance/reports");
  revalidatePath("/finance");
}

export async function listFinanceJournalEntries(options?: { take?: number }) {
  await requireFinance();
  const take = Math.min(options?.take ?? 80, 200);
  return prisma.financeJournalEntry.findMany({
    take,
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    include: {
      createdBy: { select: { name: true, email: true } },
      _count: { select: { lines: true } },
    },
  });
}

export async function getFinanceJournalEntry(entryId: string) {
  await requireFinance();
  return prisma.financeJournalEntry.findUnique({
    where: { id: entryId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      lines: {
        orderBy: { id: "asc" },
        include: {
          account: true,
          brand: { select: { id: true, name: true } },
          attachments: {
            orderBy: { uploadedAt: "asc" },
            select: {
              id: true,
              fileName: true,
              mimeType: true,
              size: true,
              uploadedAt: true,
            },
          },
          link: true,
        },
      },
    },
  });
}

const createDraftSchema = z.object({
  entryDate: z.coerce.date(),
  reference: z.string().max(120).optional().nullable(),
  memo: z.string().max(2000).optional().nullable(),
});

export async function createFinanceJournalDraft(
  input: z.infer<typeof createDraftSchema>,
) {
  const session = await requireFinance();
  const data = createDraftSchema.parse(input);
  const entry = await prisma.financeJournalEntry.create({
    data: {
      entryDate: data.entryDate,
      reference: data.reference?.trim() || null,
      memo: data.memo?.trim() || null,
      status: "DRAFT",
      createdById: session.user.id,
    },
  });
  journalPaths();
  return entry.id;
}

export async function redirectNewFinanceJournal() {
  const id = await createFinanceJournalDraft({
    entryDate: new Date(),
    reference: undefined,
    memo: undefined,
  });
  redirect(`/finance/journals/${id}`);
}

const updateHeaderSchema = z.object({
  entryId: z.string().min(1),
  entryDate: z.coerce.date(),
  reference: z.string().max(120).optional().nullable(),
  memo: z.string().max(2000).optional().nullable(),
});

export async function updateFinanceJournalHeader(
  input: z.infer<typeof updateHeaderSchema>,
) {
  await requireFinance();
  const data = updateHeaderSchema.parse(input);
  const existing = await prisma.financeJournalEntry.findUniqueOrThrow({
    where: { id: data.entryId },
  });
  if (existing.status !== "DRAFT") {
    throw new Error("Hanya jurnal berstatus draf yang dapat diubah.");
  }
  // Periode terkunci di tanggal lama atau baru juga harus diperiksa
  await ensurePeriodOpen(existing.entryDate);
  await ensurePeriodOpen(data.entryDate);
  await prisma.financeJournalEntry.update({
    where: { id: data.entryId },
    data: {
      entryDate: data.entryDate,
      reference: data.reference?.trim() || null,
      memo: data.memo?.trim() || null,
    },
  });
  journalPaths();
}

const lineLinkSchema = z.object({
  mode: z.nativeEnum(FinanceJournalLineLinkMode),
  vendorId: z.string().nullable().optional(),
  partyName: z.string().max(200).nullable().optional(),
  partyEmail: z.string().email().nullable().optional().or(z.literal("")),
  docNumber: z.string().max(120).nullable().optional(),
  docDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  billId: z.string().nullable().optional(),
  invoiceId: z.string().nullable().optional(),
});

const lineSchema = z.object({
  entryId: z.string().min(1),
  lineId: z.string().optional(),
  accountId: z.string().min(1),
  debit: z.string().default("0"),
  credit: z.string().default("0"),
  memo: z.string().max(500).optional().nullable(),
  brandId: z.string().optional().nullable(),
  currencyCode: z.string().length(3).optional(),
  amountForeign: z.string().optional().nullable(),
  /** Opsional: kalau akun adalah AP/AR control, link sub-ledger. */
  link: lineLinkSchema.nullable().optional(),
});

export async function upsertFinanceJournalLine(
  input: z.infer<typeof lineSchema>,
) {
  await requireFinance();
  const data = lineSchema.parse(input);

  const entry = await prisma.financeJournalEntry.findUniqueOrThrow({
    where: { id: data.entryId },
  });
  if (entry.status !== "DRAFT") {
    throw new Error("Jurnal sudah diposting. Gunakan tombol Balik untuk koreksi.");
  }
  await ensurePeriodOpen(entry.entryDate);

  const debit = toDecimal(data.debit);
  const credit = toDecimal(data.credit);
  if (debit.lt(0) || credit.lt(0)) {
    throw new Error("Nominal debit/kredit tidak boleh negatif.");
  }
  if (debit.gt(0) && credit.gt(0)) {
    throw new Error("Baris tidak boleh berisi debit dan kredit sekaligus.");
  }
  if (debit.lte(0) && credit.lte(0)) {
    throw new Error("Isi nominal debit atau kredit.");
  }

  // Validate AP/AR link konsistensi terhadap akun & sisi.
  const account = await prisma.financeLedgerAccount.findUniqueOrThrow({
    where: { id: data.accountId },
  });
  const link = data.link;
  if (link) {
    if (!account.isApControl && !account.isArControl) {
      throw new Error(
        "Link AP/AR hanya valid untuk akun bertanda AP/AR control.",
      );
    }
    const sideIsDebit = debit.gt(0);
    if (account.isApControl) {
      if (link.mode === FinanceJournalLineLinkMode.PAY_BILL && !sideIsDebit) {
        throw new Error("Pelunasan hutang (PAY_BILL) harus berada di sisi debit.");
      }
      if (link.mode === FinanceJournalLineLinkMode.CREATE_BILL && sideIsDebit) {
        throw new Error("Pembuatan tagihan baru (CREATE_BILL) harus berada di sisi kredit.");
      }
      if (link.mode === FinanceJournalLineLinkMode.PAY_BILL && !link.billId) {
        throw new Error("Pilih tagihan yang dilunasi.");
      }
      if (link.mode === FinanceJournalLineLinkMode.CREATE_BILL) {
        if (!link.partyName?.trim()) throw new Error("Nama vendor wajib.");
        if (!link.dueDate) throw new Error("Jatuh tempo wajib.");
      }
    }
    if (account.isArControl) {
      if (link.mode === FinanceJournalLineLinkMode.RECEIVE_INVOICE && sideIsDebit) {
        throw new Error("Penerimaan piutang (RECEIVE_INVOICE) harus berada di sisi kredit.");
      }
      if (link.mode === FinanceJournalLineLinkMode.CREATE_INVOICE && !sideIsDebit) {
        throw new Error("Pembuatan invoice baru (CREATE_INVOICE) harus berada di sisi debit.");
      }
      if (link.mode === FinanceJournalLineLinkMode.RECEIVE_INVOICE && !link.invoiceId) {
        throw new Error("Pilih invoice yang dilunasi.");
      }
      if (link.mode === FinanceJournalLineLinkMode.CREATE_INVOICE) {
        if (!link.partyName?.trim()) throw new Error("Nama pelanggan wajib.");
        if (!link.dueDate) throw new Error("Jatuh tempo wajib.");
      }
    }
  }

  const currency = (data.currencyCode ?? FINANCE_BASE_CURRENCY).toUpperCase();
  let fxSnapshot: Prisma.Decimal | null = null;
  let debitBase = debit;
  let creditBase = credit;

  if (currency !== FINANCE_BASE_CURRENCY) {
    const foreignAmt = toDecimal(
      data.amountForeign ?? (debit.gt(0) ? data.debit : data.credit),
    );
    if (foreignAmt.lte(0)) throw new Error("Jumlah valuta asing tidak valid.");
    const rate = await latestFxRate(currency, entry.entryDate);
    if (!rate) {
      throw new Error(
        `Kurs untuk ${currency} belum diatur (tanggal ${entry.entryDate.toISOString().slice(0, 10)}).`,
      );
    }
    fxSnapshot = rate.rateToBase;
    const baseAmount = foreignAmt.mul(rate.rateToBase);
    if (debit.gt(0)) {
      debitBase = baseAmount;
      creditBase = zeroDecimal();
    } else {
      creditBase = baseAmount;
      debitBase = zeroDecimal();
    }
  }

  await prisma.$transaction(async (tx) => {
    let lineId: string;
    const baseLineData = {
      accountId: data.accountId,
      debitBase,
      creditBase,
      memo: data.memo?.trim() || null,
      brandId: data.brandId || null,
      currencyCode: currency,
      amountForeign:
        currency === FINANCE_BASE_CURRENCY
          ? null
          : toDecimal(
              data.amountForeign ?? (debit.gt(0) ? data.debit : data.credit),
            ),
      fxRateSnapshot: fxSnapshot,
    };

    if (data.lineId) {
      // where memuat entryId: tanpa ini, lineId milik jurnal POSTED lain bisa
      // diedit karena cek status DRAFT di atas hanya memeriksa data.entryId.
      const updated = await tx.financeJournalLine.updateMany({
        where: { id: data.lineId, entryId: data.entryId },
        data: baseLineData,
      });
      if (updated.count === 0) {
        throw new Error("Baris jurnal tidak ditemukan pada jurnal ini.");
      }
      lineId = data.lineId;
    } else {
      const created = await tx.financeJournalLine.create({
        data: { ...baseLineData, entryId: data.entryId },
        select: { id: true },
      });
      lineId = created.id;
    }

    // Hapus link lama bila tidak ada link baru, atau upsert link baru.
    if (link) {
      await tx.financeJournalLineLink.upsert({
        where: { lineId },
        create: {
          lineId,
          mode: link.mode,
          vendorId: link.vendorId || null,
          partyName: link.partyName?.trim() || null,
          partyEmail: link.partyEmail?.trim() || null,
          docNumber: link.docNumber?.trim() || null,
          docDate: link.docDate ?? null,
          dueDate: link.dueDate ?? null,
          billId: link.billId || null,
          invoiceId: link.invoiceId || null,
        },
        update: {
          mode: link.mode,
          vendorId: link.vendorId || null,
          partyName: link.partyName?.trim() || null,
          partyEmail: link.partyEmail?.trim() || null,
          docNumber: link.docNumber?.trim() || null,
          docDate: link.docDate ?? null,
          dueDate: link.dueDate ?? null,
          billId: link.billId || null,
          invoiceId: link.invoiceId || null,
        },
      });
    } else {
      await tx.financeJournalLineLink.deleteMany({ where: { lineId } });
    }
  });

  journalPaths();
}

async function latestFxRate(currencyCode: string, asOf: Date) {
  return prisma.financeFxRate.findFirst({
    where: {
      currencyCode,
      validFrom: { lte: asOf },
    },
    orderBy: { validFrom: "desc" },
  });
}

export async function deleteFinanceJournalLine(lineId: string) {
  await requireFinance();
  const line = await prisma.financeJournalLine.findUniqueOrThrow({
    where: { id: lineId },
    include: { entry: true },
  });
  if (line.entry.status !== "DRAFT") {
    throw new Error("Jurnal sudah diposting. Gunakan tombol Balik untuk koreksi.");
  }
  await ensurePeriodOpen(line.entry.entryDate);
  await prisma.financeJournalLine.delete({ where: { id: lineId } });
  journalPaths();
}

export async function deleteFinanceJournalDraft(entryId: string) {
  const session = await requireFinance();
  const entry = await prisma.financeJournalEntry.findUniqueOrThrow({
    where: { id: entryId },
  });
  if (entry.status !== "DRAFT") {
    throw new Error("Hanya draf yang dapat dihapus.");
  }
  await ensurePeriodOpen(entry.entryDate);
  await prisma.$transaction(async (tx) => {
    await tx.financeJournalEntry.delete({ where: { id: entryId } });
    await logFinanceAudit(tx, {
      action: FinanceAuditAction.DRAFT_DELETE,
      actorId: session.user.id,
      entityId: entryId,
      detail: entry.memo ?? entry.reference ?? null,
    });
  });
  journalPaths();
}

const postedLineInput = z.object({
  accountId: z.string().min(1),
  debit: z.string().default("0"),
  credit: z.string().default("0"),
  memo: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
});

const createPostedSchema = z.object({
  entryDate: z.coerce.date(),
  reference: z.string().max(120).optional().nullable(),
  memo: z.string().max(2000).optional().nullable(),
  lines: z.array(postedLineInput).min(2),
});

/** Jurnal langsung terposting (pembayaran AP/AR, transfer, depresiasi, payout). */
export async function createPostedFinanceJournal(
  input: z.infer<typeof createPostedSchema>,
) {
  const session = await requireFinance();
  const data = createPostedSchema.parse(input);

  const entryId = await prisma.$transaction(async (tx) => {
    await ensurePeriodOpen(data.entryDate, tx);
    return createPostedEntryInTx(tx, {
      entryDate: data.entryDate,
      reference: data.reference,
      memo: data.memo,
      createdById: session.user.id,
      lines: data.lines,
    });
  });

  journalPaths();
  return entryId;
}

export async function postFinanceJournal(entryId: string) {
  const session = await requireFinance();
  await prisma.$transaction(async (tx) => {
    const entry = await tx.financeJournalEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: {
        lines: { include: { link: true, account: true } },
      },
    });
    if (entry.status !== "DRAFT") {
      throw new Error("Jurnal ini sudah diposting.");
    }
    if (entry.lines.length < 2) {
      throw new Error("Minimal dua baris untuk double-entry.");
    }

    await ensurePeriodOpen(entry.entryDate, tx);

    let debitSum = zeroDecimal();
    let creditSum = zeroDecimal();
    for (const line of entry.lines) {
      debitSum = debitSum.plus(line.debitBase);
      creditSum = creditSum.plus(line.creditBase);
    }
    if (!debitSum.equals(creditSum)) {
      throw new Error(
        `Tidak seimbang: debit ${debitSum.toFixed(2)} ≠ kredit ${creditSum.toFixed(2)}.`,
      );
    }

    const entryNumber = entry.entryNumber ?? (await nextJournalNumber(tx, entry.entryDate));
    // Compare-and-set: dua posting paralel sama-sama membaca status DRAFT di
    // READ COMMITTED; tanpa kondisi status di sini keduanya lanjut
    // mem-materialisasi sub-ledger (payment ganda).
    const claimed = await tx.financeJournalEntry.updateMany({
      where: { id: entryId, status: "DRAFT" },
      data: {
        status: "POSTED",
        postedAt: new Date(),
        postedById: session.user.id,
        entryNumber,
      },
    });
    if (claimed.count === 0) {
      throw new Error("Jurnal ini sudah diposting.");
    }
    await logFinanceAudit(tx, {
      action: FinanceAuditAction.JOURNAL_POST,
      actorId: session.user.id,
      entityId: entry.id,
      detail: entryNumber,
    });

    // Materialize sub-ledger AP/AR dari setiap link baris.
    for (const line of entry.lines) {
      const link = line.link;
      if (!link) continue;
      const amount = line.debitBase.gt(0) ? line.debitBase : line.creditBase;
      if (amount.lte(0)) continue;

      switch (link.mode) {
        case FinanceJournalLineLinkMode.CREATE_BILL: {
          if (!line.account.isApControl) {
            throw new Error(
              `Baris dengan link CREATE_BILL menargetkan akun bukan AP control (${line.account.code}).`,
            );
          }
          if (!link.partyName || !link.dueDate) {
            throw new Error("Nama vendor & jatuh tempo wajib untuk tagihan baru.");
          }
          const bill = await tx.financeApBill.create({
            data: {
              vendorId: link.vendorId || null,
              vendorName: link.partyName.trim(),
              billNumber: link.docNumber?.trim() || null,
              billDate: link.docDate ?? entry.entryDate,
              dueDate: link.dueDate,
              amount,
              status: FinanceApArDocStatus.OPEN,
              memo: line.memo,
              brandId: line.brandId,
            },
            select: { id: true },
          });
          await tx.financeJournalLineLink.update({
            where: { lineId: line.id },
            data: { createdBillId: bill.id },
          });
          break;
        }
        case FinanceJournalLineLinkMode.PAY_BILL: {
          if (!link.billId) {
            throw new Error("billId tidak ditentukan pada link PAY_BILL.");
          }
          await lockApBillForUpdate(tx, link.billId);
          const bill = await tx.financeApBill.findUniqueOrThrow({
            where: { id: link.billId },
            include: { payments: true },
          });
          const paidBefore = bill.payments.reduce(
            (s, p) => s.plus(p.amount),
            zeroDecimal(),
          );
          const remaining = bill.amount.minus(paidBefore);
          if (amount.gt(remaining)) {
            throw new Error(
              `Pembayaran melebihi sisa hutang pada bill ${bill.billNumber ?? bill.id.slice(0, 8)}.`,
            );
          }
          await tx.financeApPayment.create({
            data: {
              billId: bill.id,
              amount,
              journalEntryId: entry.id,
              recordedById: session.user.id,
            },
          });
          const paidAfter = paidBefore.plus(amount);
          let nextStatus: FinanceApArDocStatus = FinanceApArDocStatus.PARTIAL;
          if (paidAfter.gte(bill.amount)) nextStatus = FinanceApArDocStatus.PAID;
          await tx.financeApBill.update({
            where: { id: bill.id },
            data: { status: nextStatus },
          });
          break;
        }
        case FinanceJournalLineLinkMode.CREATE_INVOICE: {
          if (!line.account.isArControl) {
            throw new Error(
              `Baris dengan link CREATE_INVOICE menargetkan akun bukan AR control (${line.account.code}).`,
            );
          }
          if (!link.partyName || !link.dueDate) {
            throw new Error("Nama pelanggan & jatuh tempo wajib untuk invoice baru.");
          }
          const inv = await tx.financeArInvoice.create({
            data: {
              customerName: link.partyName.trim(),
              customerEmail: link.partyEmail?.trim() || null,
              invoiceNumber: link.docNumber?.trim() || null,
              invoiceDate: link.docDate ?? entry.entryDate,
              dueDate: link.dueDate,
              amount,
              status: FinanceApArDocStatus.OPEN,
              memo: line.memo,
              brandId: line.brandId,
            },
            select: { id: true },
          });
          await tx.financeJournalLineLink.update({
            where: { lineId: line.id },
            data: { createdInvoiceId: inv.id },
          });
          break;
        }
        case FinanceJournalLineLinkMode.RECEIVE_INVOICE: {
          if (!link.invoiceId) {
            throw new Error("invoiceId tidak ditentukan pada link RECEIVE_INVOICE.");
          }
          await lockArInvoiceForUpdate(tx, link.invoiceId);
          const inv = await tx.financeArInvoice.findUniqueOrThrow({
            where: { id: link.invoiceId },
            include: { payments: true },
          });
          const paidBefore = inv.payments.reduce(
            (s, p) => s.plus(p.amount),
            zeroDecimal(),
          );
          const remaining = inv.amount.minus(paidBefore);
          if (amount.gt(remaining)) {
            throw new Error(
              `Pembayaran melebihi sisa piutang pada invoice ${inv.invoiceNumber ?? inv.id.slice(0, 8)}.`,
            );
          }
          await tx.financeArPayment.create({
            data: {
              invoiceId: inv.id,
              amount,
              journalEntryId: entry.id,
              recordedById: session.user.id,
            },
          });
          const paidAfter = paidBefore.plus(amount);
          let nextStatus: FinanceApArDocStatus = FinanceApArDocStatus.PARTIAL;
          if (paidAfter.gte(inv.amount)) nextStatus = FinanceApArDocStatus.PAID;
          await tx.financeArInvoice.update({
            where: { id: inv.id },
            data: { status: nextStatus },
          });
          break;
        }
      }
    }
  });
  journalPaths();
  revalidatePath("/finance/ap-ar");
}

const reverseSchema = z.object({
  entryId: z.string().min(1),
  reversalDate: z.coerce.date().optional(),
  memo: z.string().max(500).optional().nullable(),
});

/**
 * Pembalikan jurnal terposting (reversing entry) — best practice akuntansi:
 * jangan edit/hapus jurnal terposting; buat jurnal baru yang menukar
 * debit↔kredit. Mata rantai dipertahankan via `reversesEntryId`.
 */
export async function reverseFinanceJournal(
  input: z.infer<typeof reverseSchema>,
) {
  const session = await requireFinance();
  const data = reverseSchema.parse(input);
  const reversalDate = data.reversalDate ?? new Date();

  // Seluruh guard berada DI DALAM transaksi; unique constraint
  // `reversesEntryId` menjadi penahan terakhir bila dua reversal berlomba.
  const reversed = await prisma.$transaction(async (tx) => {
    const target = await tx.financeJournalEntry.findUniqueOrThrow({
      where: { id: data.entryId },
      include: {
        lines: true,
        reversedBy: { select: { id: true, entryNumber: true } },
      },
    });

    if (target.status !== "POSTED") {
      throw new Error("Hanya jurnal terposting yang dapat dibalik.");
    }
    if (target.reversedBy.length > 0) {
      throw new Error(
        `Jurnal sudah dibalik oleh ${target.reversedBy[0].entryNumber ?? target.reversedBy[0].id.slice(0, 8)}.`,
      );
    }

    await ensurePeriodOpen(target.entryDate, tx);
    await ensurePeriodOpen(reversalDate, tx);

    const entryNumber = await nextJournalNumber(tx, reversalDate);
    await logFinanceAudit(tx, {
      action: FinanceAuditAction.JOURNAL_REVERSE,
      actorId: session.user.id,
      entityId: target.id,
      detail: `Dibalik oleh ${entryNumber}`,
    });
    try {
      return await tx.financeJournalEntry.create({
        data: {
          entryDate: reversalDate,
          reference: `REV-${target.entryNumber ?? target.reference ?? target.id.slice(0, 8)}`,
          memo:
            data.memo?.trim() ||
            `Pembalikan jurnal ${target.entryNumber ?? target.reference ?? target.id.slice(0, 8)}`,
          status: "POSTED",
          postedAt: new Date(),
          postedById: session.user.id,
          entryNumber,
          reversesEntryId: target.id,
          createdById: session.user.id,
          lines: {
            create: target.lines.map((l) => ({
              accountId: l.accountId,
              // Tukar sisi
              debitBase: l.creditBase,
              creditBase: l.debitBase,
              memo: l.memo ? `Pembalikan: ${l.memo}` : "Pembalikan",
              brandId: l.brandId,
              currencyCode: l.currencyCode,
              amountForeign: l.amountForeign,
              fxRateSnapshot: l.fxRateSnapshot,
            })),
          },
        },
        select: { id: true, entryNumber: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        String(
          Array.isArray(err.meta?.target)
            ? (err.meta?.target as string[]).join(",")
            : (err.meta?.target ?? ""),
        ).includes("reversesEntryId")
      ) {
        throw new Error("Jurnal ini baru saja dibalik oleh pengguna lain.");
      }
      throw err;
    }
  });

  journalPaths();
  return reversed;
}

export async function getFinanceJournalReversals(entryId: string) {
  await requireFinance();
  const entry = await prisma.financeJournalEntry.findUnique({
    where: { id: entryId },
    select: {
      reversedBy: {
        select: { id: true, entryNumber: true, entryDate: true },
      },
      reversesEntry: {
        select: { id: true, entryNumber: true, entryDate: true },
      },
    },
  });
  return entry;
}

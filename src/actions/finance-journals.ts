"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { FINANCE_BASE_CURRENCY, toDecimal, zeroDecimal } from "@/lib/finance-money";

function journalPaths() {
  revalidatePath("/finance/journals");
  revalidatePath("/finance/general-ledger");
  revalidatePath("/finance/reports");
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
        include: { account: true, brand: { select: { id: true, name: true } } },
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
    throw new Error("Jurnal sudah diposting.");
  }

  const debit = toDecimal(data.debit);
  const credit = toDecimal(data.credit);
  if (debit.gt(0) && credit.gt(0)) {
    throw new Error("Baris tidak boleh berisi debit dan kredit sekaligus.");
  }
  if (debit.lte(0) && credit.lte(0)) {
    throw new Error("Isi nominal debit atau kredit.");
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

  if (data.lineId) {
    await prisma.financeJournalLine.update({
      where: { id: data.lineId },
      data: {
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
      },
    });
  } else {
    await prisma.financeJournalLine.create({
      data: {
        entryId: data.entryId,
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
      },
    });
  }
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
    throw new Error("Jurnal sudah diposting.");
  }
  await prisma.financeJournalLine.delete({ where: { id: lineId } });
  journalPaths();
}

export async function deleteFinanceJournalDraft(entryId: string) {
  await requireFinance();
  const entry = await prisma.financeJournalEntry.findUniqueOrThrow({
    where: { id: entryId },
  });
  if (entry.status !== "DRAFT") {
    throw new Error("Hanya draf yang dapat dihapus.");
  }
  await prisma.financeJournalEntry.delete({ where: { id: entryId } });
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

  let debitSum = zeroDecimal();
  let creditSum = zeroDecimal();
  const rows = data.lines.map((l) => {
    const d = toDecimal(l.debit);
    const c = toDecimal(l.credit);
    if (d.gt(0) && c.gt(0)) throw new Error("Satu baris tidak boleh debit dan kredit bersamaan.");
    if (d.lte(0) && c.lte(0)) throw new Error("Setiap baris wajib nominal debit atau kredit.");
    debitSum = debitSum.plus(d);
    creditSum = creditSum.plus(c);
    return {
      accountId: l.accountId,
      debitBase: d,
      creditBase: c,
      memo: l.memo?.trim() || null,
      brandId: l.brandId || null,
      currencyCode: FINANCE_BASE_CURRENCY,
    };
  });

  if (!debitSum.equals(creditSum)) {
    throw new Error("Jurnal tidak seimbang.");
  }

  const created = await prisma.financeJournalEntry.create({
    data: {
      entryDate: data.entryDate,
      reference: data.reference?.trim() || null,
      memo: data.memo?.trim() || null,
      status: "POSTED",
      postedAt: new Date(),
      createdById: session.user.id,
      lines: { create: rows },
    },
    select: { id: true },
  });

  journalPaths();
  return created.id;
}

export async function postFinanceJournal(entryId: string) {
  await requireFinance();
  await prisma.$transaction(async (tx) => {
    const entry = await tx.financeJournalEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: { lines: true },
    });
    if (entry.status !== "DRAFT") {
      throw new Error("Jurnal ini sudah diposting.");
    }
    if (entry.lines.length < 2) {
      throw new Error("Minimal dua baris untuk double-entry.");
    }

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

    await tx.financeJournalEntry.update({
      where: { id: entryId },
      data: {
        status: "POSTED",
        postedAt: new Date(),
      },
    });
  });
  journalPaths();
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { toDecimal, zeroDecimal } from "@/lib/finance-money";
import { ensurePeriodOpen } from "@/lib/finance-period-lock";
import { jakartaTodayUtcDate } from "@/lib/finance-dates";
import { formatSalesCategory, formatStockLogNote } from "@/lib/stock-log-utils";

export type StockNoticeTab = "pending" | "recorded" | "dismissed";

const PAGE_LIMIT = 200;

function noticePaths() {
  revalidatePath("/finance/stock-movements");
  revalidatePath("/finance/journals");
  revalidatePath("/finance");
}

function whereForTab(tab: StockNoticeTab) {
  if (tab === "recorded") return { journalEntryId: { not: null } };
  if (tab === "dismissed") return { journalEntryId: null, dismissedAt: { not: null } };
  return { journalEntryId: null, dismissedAt: null };
}

export async function listFinanceStockNotices(tab: StockNoticeTab) {
  await requireFinance();
  const [rows, pending, recorded, dismissed] = await Promise.all([
    prisma.financeStockNotice.findMany({
      where: whereForTab(tab),
      orderBy: { createdAt: "desc" },
      take: PAGE_LIMIT,
      include: {
        stockLog: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                brand: { select: { name: true } },
              },
            },
            vendor: { select: { name: true } },
            createdBy: { select: { name: true, email: true } },
          },
        },
        journalEntry: {
          select: { id: true, status: true, entryNumber: true },
        },
        handledBy: { select: { name: true, email: true } },
      },
    }),
    prisma.financeStockNotice.count({ where: whereForTab("pending") }),
    prisma.financeStockNotice.count({ where: whereForTab("recorded") }),
    prisma.financeStockNotice.count({ where: whereForTab("dismissed") }),
  ]);
  return { rows, counts: { pending, recorded, dismissed }, limit: PAGE_LIMIT };
}

const recordSchema = z.object({
  noticeId: z.string().min(1),
  /** Nilai total mutasi (IDR). Kosong = draf tanpa baris, diisi di editor. */
  amount: z.string().max(40).optional().nullable(),
  debitAccountId: z.string().optional().nullable(),
  creditAccountId: z.string().optional().nullable(),
});

/**
 * "Masukkan ke pencatatan": buat DRAF jurnal dari satu mutasi stok. Sengaja
 * tidak langsung posting — inventori tidak menyimpan harga pokok, jadi nilai
 * dan akun diperiksa Finance di editor jurnal, lalu diposting lewat alur
 * posting biasa (validasi seimbang, kunci periode, nomor jurnal).
 */
export async function recordStockNoticeToJournal(
  input: z.infer<typeof recordSchema>,
): Promise<string> {
  const session = await requireFinance();
  const data = recordSchema.parse(input);
  const amount = data.amount?.trim() ? toDecimal(data.amount) : zeroDecimal();
  if (amount.lt(0)) throw new Error("Nilai tidak boleh negatif.");
  const withLines = amount.gt(0);
  if (withLines) {
    if (!data.debitAccountId || !data.creditAccountId) {
      throw new Error("Pilih akun debit dan kredit, atau kosongkan nilainya.");
    }
    if (data.debitAccountId === data.creditAccountId) {
      throw new Error("Akun debit dan kredit tidak boleh sama.");
    }
  }

  const entryId = await prisma.$transaction(async (tx) => {
    const notice = await tx.financeStockNotice.findUniqueOrThrow({
      where: { id: data.noticeId },
      include: {
        stockLog: {
          include: {
            product: { select: { name: true, sku: true, brandId: true } },
            vendor: { select: { name: true } },
          },
        },
      },
    });
    if (notice.journalEntryId) {
      throw new Error("Mutasi ini sudah dimasukkan ke pencatatan.");
    }
    const log = notice.stockLog;

    // Tanggal kalender Jakarta saat mutasi terjadi, sebagai tanggal murni UTC
    // (konvensi `entryDate`).
    const entryDate = jakartaTodayUtcDate(log.createdAt);
    await ensurePeriodOpen(entryDate, tx);

    if (withLines) {
      const accounts = await tx.financeLedgerAccount.findMany({
        where: { id: { in: [data.debitAccountId!, data.creditAccountId!] } },
        select: { id: true, isActive: true, isApControl: true, isArControl: true },
      });
      if (accounts.length !== 2 || accounts.some((a) => !a.isActive)) {
        throw new Error("Akun tidak ditemukan atau sudah nonaktif.");
      }
      if (accounts.some((a) => a.isApControl || a.isArControl)) {
        throw new Error(
          "Akun hutang/piutang usaha butuh data tagihan — kosongkan nilainya lalu tambahkan baris itu di editor jurnal.",
        );
      }
    }

    const direction = log.type === "IN" ? "Barang masuk" : "Barang keluar";
    const noteText = formatStockLogNote(log);
    const memo = [
      `${direction}: ${log.amount.toLocaleString("id-ID")} × ${log.product.name} (${log.product.sku})`,
      log.type === "OUT" && log.salesCategory
        ? formatSalesCategory(log.salesCategory)
        : null,
      log.vendor ? `Vendor: ${log.vendor.name}` : null,
      noteText !== "—" ? noteText : null,
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 2000);

    const entry = await tx.financeJournalEntry.create({
      data: {
        entryDate,
        reference: log.reference?.trim() || null,
        memo,
        status: "DRAFT",
        createdById: session.user.id,
        ...(withLines
          ? {
              lines: {
                create: [
                  {
                    accountId: data.debitAccountId!,
                    debitBase: amount.toDecimalPlaces(2),
                    creditBase: zeroDecimal(),
                    brandId: log.product.brandId,
                  },
                  {
                    accountId: data.creditAccountId!,
                    debitBase: zeroDecimal(),
                    creditBase: amount.toDecimalPlaces(2),
                    brandId: log.product.brandId,
                  },
                ],
              },
            }
          : {}),
      },
      select: { id: true },
    });

    // Guard `journalEntryId: null` menahan dua klik paralel membuat dua draf.
    const claimed = await tx.financeStockNotice.updateMany({
      where: { id: notice.id, journalEntryId: null },
      data: {
        journalEntryId: entry.id,
        dismissedAt: null,
        dismissNote: null,
        handledById: session.user.id,
        handledAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      throw new Error("Mutasi ini sudah dimasukkan ke pencatatan.");
    }
    return entry.id;
  });

  noticePaths();
  return entryId;
}

const dismissSchema = z.object({
  noticeId: z.string().min(1),
  note: z.string().max(300).optional().nullable(),
});

/** Tandai mutasi tidak perlu jurnal tersendiri (mis. sudah tercakup jurnal lain). */
export async function dismissStockNotice(input: z.infer<typeof dismissSchema>) {
  const session = await requireFinance();
  const data = dismissSchema.parse(input);
  const res = await prisma.financeStockNotice.updateMany({
    where: { id: data.noticeId, journalEntryId: null, dismissedAt: null },
    data: {
      dismissedAt: new Date(),
      dismissNote: data.note?.trim() || null,
      handledById: session.user.id,
      handledAt: new Date(),
    },
  });
  if (res.count === 0) throw new Error("Mutasi ini sudah ditangani.");
  noticePaths();
}

export async function restoreStockNotice(noticeId: string) {
  await requireFinance();
  const res = await prisma.financeStockNotice.updateMany({
    where: { id: noticeId, journalEntryId: null, dismissedAt: { not: null } },
    data: { dismissedAt: null, dismissNote: null, handledById: null, handledAt: null },
  });
  if (res.count === 0) throw new Error("Mutasi ini tidak sedang diabaikan.");
  noticePaths();
}

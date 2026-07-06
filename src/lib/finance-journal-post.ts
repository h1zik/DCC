import "server-only";

import { FinanceApArDocStatus, Prisma } from "@prisma/client";
import {
  FINANCE_BASE_CURRENCY,
  toDecimal,
  zeroDecimal,
} from "@/lib/finance-money";
import { nextJournalNumber } from "@/lib/finance-journal-number";

/**
 * Pembuatan jurnal POSTED di dalam transaksi PEMANGGIL.
 *
 * Dulu setiap alur (bayar hutang/piutang, payout, transfer, depresiasi)
 * memanggil server action `createPostedFinanceJournal` yang membuka
 * transaksinya sendiri, lalu menulis payment/status di luar transaksi —
 * crash atau double-submit meninggalkan GL dan sub-ledger yang tidak
 * konsisten. Helper ini menerima `tx` sehingga jurnal + payment + status
 * menjadi satu unit atomik.
 */

export type FinanceTx = Prisma.TransactionClient;

export interface PostedJournalLineInput {
  accountId: string;
  debit: string;
  credit: string;
  memo?: string | null;
  brandId?: string | null;
}

export interface PostedJournalInput {
  entryDate: Date;
  reference?: string | null;
  memo?: string | null;
  createdById: string;
  lines: PostedJournalLineInput[];
}

/** Validasi baris + buat entry POSTED. Mengembalikan id jurnal. */
export async function createPostedEntryInTx(
  tx: FinanceTx,
  input: PostedJournalInput,
): Promise<string> {
  if (input.lines.length < 2) {
    throw new Error("Minimal dua baris untuk double-entry.");
  }

  let debitSum = zeroDecimal();
  let creditSum = zeroDecimal();
  const rows = input.lines.map((l) => {
    // Bulatkan ke 2 desimal SEBELUM validasi & penyimpanan — dulu validasi
    // menjumlah nilai mentah lalu Postgres membulatkan per-baris secara
    // independen, sehingga input >2dp bisa lolos seimbang tapi tersimpan
    // tidak seimbang.
    const d = toDecimal(l.debit).toDecimalPlaces(2);
    const c = toDecimal(l.credit).toDecimalPlaces(2);
    if (d.lt(0) || c.lt(0)) throw new Error("Nominal debit/kredit tidak boleh negatif.");
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

  const entryNumber = await nextJournalNumber(tx, input.entryDate);
  const created = await tx.financeJournalEntry.create({
    data: {
      entryDate: input.entryDate,
      reference: input.reference?.trim() || null,
      memo: input.memo?.trim() || null,
      status: "POSTED",
      postedAt: new Date(),
      // Jalur posted-langsung: pembuat = pem-posting.
      postedById: input.createdById,
      entryNumber,
      createdById: input.createdById,
      lines: { create: rows },
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Kunci baris bill (SELECT ... FOR UPDATE) sebelum menghitung sisa hutang.
 * Tanpa ini, dua pembayaran paralel sama-sama membaca `payments` lama dan
 * keduanya lolos guard overpayment (READ COMMITTED).
 */
export async function lockApBillForUpdate(tx: FinanceTx, billId: string) {
  await tx.$queryRaw`SELECT id FROM "FinanceApBill" WHERE id = ${billId} FOR UPDATE`;
}

/** Padanan `lockApBillForUpdate` untuk invoice piutang. */
export async function lockArInvoiceForUpdate(tx: FinanceTx, invoiceId: string) {
  await tx.$queryRaw`SELECT id FROM "FinanceArInvoice" WHERE id = ${invoiceId} FOR UPDATE`;
}

/** Status dokumen AP/AR berdasarkan total terbayar vs nominal dokumen. */
export function apArStatusForPaid(
  amount: Prisma.Decimal,
  paid: Prisma.Decimal,
): FinanceApArDocStatus {
  if (paid.lte(0)) return FinanceApArDocStatus.OPEN;
  return paid.gte(amount)
    ? FinanceApArDocStatus.PAID
    : FinanceApArDocStatus.PARTIAL;
}

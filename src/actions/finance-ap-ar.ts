"use server";

import { FinanceApArDocStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import {
  createPostedEntryInTx,
  lockApBillForUpdate,
  lockArInvoiceForUpdate,
} from "@/lib/finance-journal-post";
import { ensurePeriodOpen } from "@/lib/finance-period-lock";
import { positiveMoneyString, toDecimal, zeroDecimal } from "@/lib/finance-money";

function paths() {
  revalidatePath("/finance/ap-ar");
}

/**
 * Bill yang masih ada sisa hutang. Dipakai oleh dropdown "PAY_BILL" pada
 * editor jurnal saat akun AP control dipilih di sisi debit.
 */
export async function listOpenFinanceApBills() {
  await requireFinance();
  const bills = await prisma.financeApBill.findMany({
    where: { status: { in: [FinanceApArDocStatus.OPEN, FinanceApArDocStatus.PARTIAL] } },
    orderBy: { dueDate: "asc" },
    include: { payments: { select: { amount: true } } },
  });
  return bills.map((b) => {
    const paid = b.payments.reduce((s, p) => s.plus(p.amount), zeroDecimal());
    const remaining = b.amount.minus(paid);
    return {
      id: b.id,
      vendorName: b.vendorName,
      billNumber: b.billNumber,
      dueDateIso: b.dueDate.toISOString(),
      amount: b.amount.toString(),
      remaining: remaining.toString(),
    };
  });
}

/** Invoice yang masih ada sisa piutang. Dipakai dropdown "RECEIVE_INVOICE". */
export async function listOpenFinanceArInvoices() {
  await requireFinance();
  const inv = await prisma.financeArInvoice.findMany({
    where: { status: { in: [FinanceApArDocStatus.OPEN, FinanceApArDocStatus.PARTIAL] } },
    orderBy: { dueDate: "asc" },
    include: { payments: { select: { amount: true } } },
  });
  return inv.map((i) => {
    const paid = i.payments.reduce((s, p) => s.plus(p.amount), zeroDecimal());
    const remaining = i.amount.minus(paid);
    return {
      id: i.id,
      customerName: i.customerName,
      invoiceNumber: i.invoiceNumber,
      dueDateIso: i.dueDate.toISOString(),
      amount: i.amount.toString(),
      remaining: remaining.toString(),
    };
  });
}

export async function listFinanceApBills() {
  await requireFinance();
  return prisma.financeApBill.findMany({
    orderBy: { dueDate: "asc" },
    include: { vendor: true, brand: true },
  });
}

export async function listFinanceArInvoices() {
  await requireFinance();
  return prisma.financeArInvoice.findMany({
    orderBy: { dueDate: "asc" },
    include: { brand: true },
  });
}

const billSchema = z.object({
  vendorId: z.string().optional().nullable(),
  vendorName: z.string().min(1),
  billNumber: z.string().optional().nullable(),
  billDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  amount: positiveMoneyString,
  memo: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
});

export async function createFinanceApBill(input: z.infer<typeof billSchema>) {
  await requireFinance();
  const data = billSchema.parse(input);
  await prisma.financeApBill.create({
    data: {
      vendorId: data.vendorId || null,
      vendorName: data.vendorName.trim(),
      billNumber: data.billNumber?.trim() || null,
      billDate: data.billDate,
      dueDate: data.dueDate,
      amount: toDecimal(data.amount),
      status: FinanceApArDocStatus.OPEN,
      memo: data.memo?.trim() || null,
      brandId: data.brandId || null,
    },
  });
  paths();
}

const invSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  amount: positiveMoneyString,
  memo: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
});

export async function createFinanceArInvoice(input: z.infer<typeof invSchema>) {
  await requireFinance();
  const data = invSchema.parse(input);
  await prisma.financeArInvoice.create({
    data: {
      customerName: data.customerName.trim(),
      customerEmail: data.customerEmail?.trim() || null,
      invoiceNumber: data.invoiceNumber?.trim() || null,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      amount: toDecimal(data.amount),
      status: FinanceApArDocStatus.OPEN,
      memo: data.memo?.trim() || null,
      brandId: data.brandId || null,
    },
  });
  paths();
}

const payApSchema = z.object({
  billId: z.string().min(1),
  amount: positiveMoneyString,
  bankAccountId: z.string().min(1),
  paidAt: z.coerce.date(),
});

export async function recordApBillPayment(input: z.infer<typeof payApSchema>) {
  const session = await requireFinance();
  const data = payApSchema.parse(input);
  const amt = toDecimal(data.amount);

  // Satu transaksi untuk: kunci bill -> cek sisa -> jurnal -> payment ->
  // status. Dulu 4 operasi terpisah: dua pembayaran paralel sama-sama lolos
  // cek sisa (overpayment), dan crash di tengah meninggalkan jurnal tanpa
  // payment (bill bisa dibayar dua kali).
  await prisma.$transaction(async (tx) => {
    await ensurePeriodOpen(data.paidAt, tx);
    await lockApBillForUpdate(tx, data.billId);

    const bill = await tx.financeApBill.findUniqueOrThrow({
      where: { id: data.billId },
      include: { payments: true },
    });
    if (bill.status === FinanceApArDocStatus.VOID) {
      throw new Error("Tagihan tidak aktif.");
    }

    const paidBefore = bill.payments.reduce(
      (s, p) => s.plus(p.amount),
      zeroDecimal(),
    );
    const remaining = bill.amount.minus(paidBefore);
    if (amt.gt(remaining)) throw new Error("Melebihi sisa hutang.");

    const apAccount = await tx.financeLedgerAccount.findUnique({
      where: { code: "2000" },
    });
    if (!apAccount) throw new Error('Akun "2000 Hutang usaha" tidak ada — inisialisasi CoA.');

    const bank = await tx.financeBankAccount.findUniqueOrThrow({
      where: { id: data.bankAccountId },
    });

    const journalId = await createPostedEntryInTx(tx, {
      entryDate: data.paidAt,
      reference: bill.billNumber ?? `AP-${bill.id.slice(0, 8)}`,
      memo: `Bayar hutang: ${bill.vendorName}`,
      createdById: session.user.id,
      lines: [
        {
          accountId: apAccount.id,
          debit: amt.toFixed(2),
          credit: "0",
          memo: "Pelunasan hutang usaha",
          brandId: bill.brandId,
        },
        {
          accountId: bank.ledgerAccountId,
          debit: "0",
          credit: amt.toFixed(2),
          memo: "Keluar bank",
          brandId: bill.brandId,
        },
      ],
    });

    await tx.financeApPayment.create({
      data: {
        billId: bill.id,
        amount: amt,
        journalEntryId: journalId,
        recordedById: session.user.id,
      },
    });

    const paidAfter = paidBefore.plus(amt);
    const status = paidAfter.gte(bill.amount)
      ? FinanceApArDocStatus.PAID
      : FinanceApArDocStatus.PARTIAL;
    await tx.financeApBill.update({
      where: { id: bill.id },
      data: { status },
    });
  });

  paths();
}

const payArSchema = z.object({
  invoiceId: z.string().min(1),
  amount: positiveMoneyString,
  bankAccountId: z.string().min(1),
  receivedAt: z.coerce.date(),
});

export async function recordArInvoicePayment(input: z.infer<typeof payArSchema>) {
  const session = await requireFinance();
  const data = payArSchema.parse(input);
  const amt = toDecimal(data.amount);

  // Lihat catatan atomisitas di recordApBillPayment — pola yang sama.
  await prisma.$transaction(async (tx) => {
    await ensurePeriodOpen(data.receivedAt, tx);
    await lockArInvoiceForUpdate(tx, data.invoiceId);

    const inv = await tx.financeArInvoice.findUniqueOrThrow({
      where: { id: data.invoiceId },
      include: { payments: true },
    });
    if (inv.status === FinanceApArDocStatus.VOID) {
      throw new Error("Invoice tidak aktif.");
    }

    const paidBefore = inv.payments.reduce(
      (s, p) => s.plus(p.amount),
      zeroDecimal(),
    );
    const remaining = inv.amount.minus(paidBefore);
    if (amt.gt(remaining)) throw new Error("Melebihi sisa piutang.");

    const arAccount = await tx.financeLedgerAccount.findUnique({
      where: { code: "1200" },
    });
    if (!arAccount) throw new Error('Akun "1200 Piutang usaha" tidak ada — inisialisasi CoA.');

    const bank = await tx.financeBankAccount.findUniqueOrThrow({
      where: { id: data.bankAccountId },
    });

    const journalId = await createPostedEntryInTx(tx, {
      entryDate: data.receivedAt,
      reference: inv.invoiceNumber ?? `AR-${inv.id.slice(0, 8)}`,
      memo: `Terima piutang: ${inv.customerName}`,
      createdById: session.user.id,
      lines: [
        {
          accountId: bank.ledgerAccountId,
          debit: amt.toFixed(2),
          credit: "0",
          memo: "Masuk bank",
          brandId: inv.brandId,
        },
        {
          accountId: arAccount.id,
          debit: "0",
          credit: amt.toFixed(2),
          memo: "Pelunasan piutang",
          brandId: inv.brandId,
        },
      ],
    });

    await tx.financeArPayment.create({
      data: {
        invoiceId: inv.id,
        amount: amt,
        journalEntryId: journalId,
        recordedById: session.user.id,
      },
    });

    const paidAfter = paidBefore.plus(amt);
    const status = paidAfter.gte(inv.amount)
      ? FinanceApArDocStatus.PAID
      : FinanceApArDocStatus.PARTIAL;
    await tx.financeArInvoice.update({
      where: { id: inv.id },
      data: { status },
    });
  });

  paths();
}

/** Aging bucket dalam hari sampai jatuh tempo (negatif = overdue). */
export async function financeApAgingBuckets() {
  await requireFinance();
  const bills = await prisma.financeApBill.findMany({
    where: {
      status: { in: [FinanceApArDocStatus.OPEN, FinanceApArDocStatus.PARTIAL] },
    },
    include: { payments: true },
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  type Bucket = "current" | "d1_30" | "d31_60" | "over60";
  const sums: Record<Bucket, Prisma.Decimal> = {
    current: zeroDecimal(),
    d1_30: zeroDecimal(),
    d31_60: zeroDecimal(),
    over60: zeroDecimal(),
  };

  for (const b of bills) {
    const paid = b.payments.reduce((s, p) => s.plus(p.amount), zeroDecimal());
    const open = b.amount.minus(paid);
    if (open.lte(0)) continue;

    const due = new Date(b.dueDate);
    due.setHours(0, 0, 0, 0);
    const diff = Math.floor(
      (due.getTime() - today.getTime()) / (24 * 3600 * 1000),
    );
    let key: Bucket = "current";
    if (diff < -60) key = "over60";
    else if (diff < -30) key = "d31_60";
    else if (diff < 0) key = "d1_30";

    sums[key] = sums[key].plus(open);
  }

  return sums;
}

"use server";

import { FinanceSpendRequestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { createPostedFinanceJournal } from "@/actions/finance-journals";
import { toDecimal } from "@/lib/finance-money";

function paths() {
  revalidatePath("/finance/approvals");
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  amount: z.string().min(1),
  expenseAccountId: z.string().min(1),
  brandId: z.string().optional().nullable(),
});

export async function createFinanceSpendRequest(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireFinance();
  const data = createSchema.parse(input);
  await prisma.financeSpendRequest.create({
    data: {
      title: data.title.trim(),
      description: data.description?.trim() || null,
      amount: toDecimal(data.amount),
      expenseAccountId: data.expenseAccountId,
      brandId: data.brandId || null,
      status: FinanceSpendRequestStatus.DRAFT,
      requestedById: session.user.id,
    },
  });
  paths();
}

export async function submitFinanceSpendRequest(requestId: string) {
  await requireFinance();
  const r = await prisma.financeSpendRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  if (r.status !== FinanceSpendRequestStatus.DRAFT) {
    throw new Error("Hanya draf yang dapat diajukan.");
  }
  await prisma.financeSpendRequest.update({
    where: { id: requestId },
    data: { status: FinanceSpendRequestStatus.SUBMITTED },
  });
  paths();
}

export async function approveFinanceSpendRequest(
  requestId: string,
  note?: string | null,
) {
  const session = await requireFinance();
  const r = await prisma.financeSpendRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  if (r.status !== FinanceSpendRequestStatus.SUBMITTED) {
    throw new Error("Pengajuan tidak menunggu persetujuan.");
  }
  await prisma.financeSpendRequest.update({
    where: { id: requestId },
    data: {
      status: FinanceSpendRequestStatus.APPROVED,
      decidedById: session.user.id,
      decidedAt: new Date(),
      decisionNote: note?.trim() || null,
    },
  });
  paths();
}

export async function rejectFinanceSpendRequest(
  requestId: string,
  note?: string | null,
) {
  const session = await requireFinance();
  const r = await prisma.financeSpendRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  if (r.status !== FinanceSpendRequestStatus.SUBMITTED) {
    throw new Error("Pengajuan tidak menunggu persetujuan.");
  }
  await prisma.financeSpendRequest.update({
    where: { id: requestId },
    data: {
      status: FinanceSpendRequestStatus.REJECTED,
      decidedById: session.user.id,
      decidedAt: new Date(),
      decisionNote: note?.trim() || null,
    },
  });
  paths();
}

const payoutSchema = z.object({
  requestId: z.string().min(1),
  bankAccountId: z.string().min(1),
  paidAt: z.coerce.date(),
});

/** Mencatat pembayaran yang disetujui → jurnal Beban / Bank. */
export async function recordFinanceSpendPayout(input: z.infer<typeof payoutSchema>) {
  const session = await requireFinance();
  const data = payoutSchema.parse(input);

  const req = await prisma.financeSpendRequest.findUniqueOrThrow({
    where: { id: data.requestId },
    include: { expenseAccount: true },
  });
  if (req.status !== FinanceSpendRequestStatus.APPROVED) {
    throw new Error("Hanya pengajuan disetujui yang dapat dibayar.");
  }
  if (req.payoutEntryId) {
    throw new Error("Pengajuan ini sudah dibayar.");
  }
  if (!req.expenseAccountId || !req.expenseAccount) {
    throw new Error("Akun beban tidak valid.");
  }

  const bank = await prisma.financeBankAccount.findUniqueOrThrow({
    where: { id: data.bankAccountId },
  });

  const amt = req.amount.toFixed(2);

  const journalId = await createPostedFinanceJournal({
    entryDate: data.paidAt,
    reference: `REQ-${req.id.slice(0, 8)}`,
    memo: req.title,
    lines: [
      {
        accountId: req.expenseAccountId,
        debit: amt,
        credit: "0",
        memo: req.title,
        brandId: req.brandId,
      },
      {
        accountId: bank.ledgerAccountId,
        debit: "0",
        credit: amt,
        memo: req.title,
        brandId: req.brandId,
      },
    ],
  });

  await prisma.financeSpendRequest.update({
    where: { id: req.id },
    data: {
      status: FinanceSpendRequestStatus.PAID,
      payoutEntryId: journalId,
    },
  });

  paths();
}

export async function listFinanceSpendRequests() {
  await requireFinance();
  return prisma.financeSpendRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      requestedBy: { select: { name: true, email: true } },
      decidedBy: { select: { name: true, email: true } },
      expenseAccount: true,
      brand: true,
    },
  });
}

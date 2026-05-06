"use server";

import { FinanceLedgerType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { signedBalanceForAccount } from "@/lib/finance-money";

const querySchema = z.object({
  accountId: z.string().optional(),
  from: z.coerce.date(),
  to: z.coerce.date(),
  brandId: z.string().optional().nullable(),
});

export async function queryGeneralLedger(input: z.infer<typeof querySchema>) {
  await requireFinance();
  const q = querySchema.parse(input);

  const lines = await prisma.financeJournalLine.findMany({
    where: {
      entry: {
        status: "POSTED",
        entryDate: { gte: q.from, lte: endOfDay(q.to) },
      },
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.brandId ? { brandId: q.brandId } : {}),
    },
    orderBy: [
      { account: { code: "asc" } },
      { entry: { entryDate: "asc" } },
      { id: "asc" },
    ],
    include: {
      account: true,
      entry: { select: { id: true, entryDate: true, reference: true, memo: true } },
      brand: { select: { id: true, name: true } },
    },
  });

  /** Saldo awal per akun (sebelum `from`). */
  const openingLines = await prisma.financeJournalLine.findMany({
    where: {
      entry: {
        status: "POSTED",
        entryDate: { lt: q.from },
      },
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.brandId ? { brandId: q.brandId } : {}),
    },
    include: { account: true },
  });

  const openingByAccount = new Map<string, Prisma.Decimal>();
  for (const ol of openingLines) {
    const net = signedBalanceForAccount(
      ol.account.type,
      ol.debitBase,
      ol.creditBase,
    );
    openingByAccount.set(
      ol.accountId,
      (openingByAccount.get(ol.accountId) ?? new Prisma.Decimal(0)).plus(net),
    );
  }

  return { lines, openingByAccount };
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

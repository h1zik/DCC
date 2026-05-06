"use server";

import { FinanceLedgerType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import {
  signedBalanceForAccount,
  toDecimal,
  zeroDecimal,
} from "@/lib/finance-money";

const upsertSchema = z.object({
  id: z.string().optional(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  brandId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  amountLimit: z.string().min(1),
});

export async function upsertFinanceBudgetLine(input: z.infer<typeof upsertSchema>) {
  await requireFinance();
  const data = upsertSchema.parse(input);

  const payload = {
    year: data.year,
    month: data.month,
    brandId: data.brandId || null,
    accountId: data.accountId || null,
    amountLimit: toDecimal(data.amountLimit),
  };

  if (data.id) {
    await prisma.financeBudgetLine.update({
      where: { id: data.id },
      data: payload,
    });
  } else {
    await prisma.financeBudgetLine.create({ data: payload });
  }

  revalidatePath("/finance/budget");
}

export async function listFinanceBudgetLines(year: number) {
  await requireFinance();
  return prisma.financeBudgetLine.findMany({
    where: { year },
    orderBy: [{ month: "asc" }, { brandId: "asc" }],
    include: { brand: true, account: true },
  });
}

export async function financeBudgetVsActual(input: {
  year: number;
  month: number;
}) {
  await requireFinance();
  const start = new Date(input.year, input.month - 1, 1);
  const end = new Date(input.year, input.month, 0, 23, 59, 59, 999);

  const budgets = await prisma.financeBudgetLine.findMany({
    where: { year: input.year, month: input.month },
    include: { brand: true, account: true },
  });

  const lines = await prisma.financeJournalLine.findMany({
    where: {
      entry: {
        status: "POSTED",
        entryDate: { gte: start, lte: end },
      },
      account: { type: FinanceLedgerType.EXPENSE },
    },
    include: { account: true },
  });

  const rows: {
    budgetId: string;
    label: string;
    limit: Prisma.Decimal;
    actual: Prisma.Decimal;
    variance: Prisma.Decimal;
  }[] = [];

  for (const b of budgets) {
    let actual = zeroDecimal();
    for (const ln of lines) {
      if (b.accountId && ln.accountId !== b.accountId) continue;
      if (b.brandId && ln.brandId !== b.brandId) continue;

      actual = actual.plus(
        signedBalanceForAccount(
          ln.account.type,
          ln.debitBase,
          ln.creditBase,
        ),
      );
    }

    const label = [
      b.account?.code ?? "SEMUA_BEBAN",
      b.brand?.name ?? "Semua brand",
    ].join(" · ");

    rows.push({
      budgetId: b.id,
      label,
      limit: b.amountLimit,
      actual,
      variance: b.amountLimit.minus(actual),
    });
  }

  return rows;
}

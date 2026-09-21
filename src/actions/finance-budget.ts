"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { computeBudgetVsActual } from "@/lib/finance-budget-actual";
import { nonNegativeMoneyString, toDecimal } from "@/lib/finance-money";

const upsertSchema = z.object({
  id: z.string().optional(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  brandId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  amountLimit: nonNegativeMoneyString,
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
    // Satu sel budget = kombinasi (tahun, bulan, brand, akun). Cek-lalu-tulis
    // tanpa kunci masih bisa lolos bila dua submit berbarengan; advisory lock
    // per sel menserialkannya (rilis saat commit). Sengaja bukan unique
    // constraint: data lama bisa saja sudah punya duplikat.
    const cellKey = `finance-budget:${payload.year}:${payload.month}:${payload.brandId ?? "-"}:${payload.accountId ?? "-"}`;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cellKey}))`;
      const existing = await tx.financeBudgetLine.findFirst({
        where: {
          year: payload.year,
          month: payload.month,
          brandId: payload.brandId,
          accountId: payload.accountId,
        },
        select: { id: true },
      });
      if (existing) {
        await tx.financeBudgetLine.update({
          where: { id: existing.id },
          data: payload,
        });
      } else {
        await tx.financeBudgetLine.create({ data: payload });
      }
    });
  }

  revalidatePath("/finance/budget");
}

export async function financeBudgetVsActual(input: {
  year: number;
  month: number;
  brandId?: string | null;
}) {
  await requireFinance();
  return computeBudgetVsActual(input);
}

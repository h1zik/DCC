"use server";

import { FinanceAuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { logFinanceAudit } from "@/lib/finance-audit";
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
  const session = await requireFinance();
  const data = upsertSchema.parse(input);

  const payload = {
    year: data.year,
    month: data.month,
    brandId: data.brandId || null,
    accountId: data.accountId || null,
    amountLimit: toDecimal(data.amountLimit),
  };

  const cellLabel = `${payload.year}-${String(payload.month).padStart(2, "0")}`;
  const audit = (
    tx: Parameters<typeof logFinanceAudit>[0],
    budgetId: string,
    before: string | null,
  ) =>
    logFinanceAudit(tx, {
      action: FinanceAuditAction.BUDGET_UPSERT,
      actorId: session.user.id,
      entityId: budgetId,
      detail: `Anggaran ${cellLabel}: ${before ?? "—"} → ${payload.amountLimit.toFixed(2)}`,
      meta: {
        before: before === null ? null : { amountLimit: before },
        after: {
          amountLimit: payload.amountLimit.toFixed(2),
          brandId: payload.brandId,
          accountId: payload.accountId,
        },
      },
    });

  if (data.id) {
    const budgetId = data.id;
    await prisma.$transaction(async (tx) => {
      const prev = await tx.financeBudgetLine.findUniqueOrThrow({
        where: { id: budgetId },
        select: { amountLimit: true },
      });
      await tx.financeBudgetLine.update({ where: { id: budgetId }, data: payload });
      await audit(tx, budgetId, prev.amountLimit.toFixed(2));
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
        select: { id: true, amountLimit: true },
      });
      if (existing) {
        await tx.financeBudgetLine.update({
          where: { id: existing.id },
          data: payload,
        });
        await audit(tx, existing.id, existing.amountLimit.toFixed(2));
      } else {
        const created = await tx.financeBudgetLine.create({
          data: payload,
          select: { id: true },
        });
        await audit(tx, created.id, null);
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

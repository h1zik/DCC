"use server";

import { FinanceDepreciationMethod, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { createPostedFinanceJournal } from "@/actions/finance-journals";
import { toDecimal } from "@/lib/finance-money";

function paths() {
  revalidatePath("/finance/fixed-assets");
}

const assetSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(120).optional().nullable(),
  purchaseDate: z.coerce.date(),
  cost: z.string().min(1),
  salvageValue: z.string().optional().default("0"),
  usefulLifeMonths: z.number().int().min(1).max(600),
  method: z.nativeEnum(FinanceDepreciationMethod).optional(),
  assetAccountId: z.string().min(1),
  accumAccountId: z.string().min(1),
  expenseAccountId: z.string().min(1),
});

export async function createFinanceFixedAsset(input: z.infer<typeof assetSchema>) {
  await requireFinance();
  const data = assetSchema.parse(input);
  await prisma.financeFixedAsset.create({
    data: {
      name: data.name.trim(),
      category: data.category?.trim() || null,
      purchaseDate: data.purchaseDate,
      cost: toDecimal(data.cost),
      salvageValue: toDecimal(data.salvageValue),
      usefulLifeMonths: data.usefulLifeMonths,
      method: data.method ?? FinanceDepreciationMethod.STRAIGHT_LINE,
      assetAccountId: data.assetAccountId,
      accumAccountId: data.accumAccountId,
      expenseAccountId: data.expenseAccountId,
    },
  });
  paths();
}

export async function listFinanceFixedAssets() {
  await requireFinance();
  return prisma.financeFixedAsset.findMany({
    orderBy: { purchaseDate: "desc" },
    include: {
      assetAccount: true,
      accumAccount: true,
      expenseAccount: true,
    },
  });
}

const depSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
});

/**
 * Penyusutan garis lurus per bulan; satu jurnal gabungan untuk semua aset aktif.
 */
export async function postFinanceDepreciationForMonth(
  input: z.infer<typeof depSchema>,
) {
  await requireFinance();
  const data = depSchema.parse(input);

  const assets = await prisma.financeFixedAsset.findMany({
    where: {
      disposedAt: null,
      purchaseDate: {
        lte: lastDayOfMonth(data.year, data.month),
      },
    },
  });

  const lines: {
    accountId: string;
    debit: string;
    credit: string;
    memo: string;
  }[] = [];

  const updates: { id: string; add: Prisma.Decimal }[] = [];

  for (const a of assets) {
    const cap = a.cost.minus(a.salvageValue);
    const remaining = cap.minus(a.accumulatedDepreciation);
    if (remaining.lte(0)) continue;

    let monthly = a.cost
      .minus(a.salvageValue)
      .dividedBy(a.usefulLifeMonths);
    if (monthly.gt(remaining)) monthly = remaining;
    if (monthly.lte(0)) continue;

    const m = monthly.toFixed(2);

    lines.push({
      accountId: a.expenseAccountId,
      debit: m,
      credit: "0",
      memo: `Depresiasi ${a.name}`,
    });
    lines.push({
      accountId: a.accumAccountId,
      debit: "0",
      credit: m,
      memo: `Akumulasi ${a.name}`,
    });

    updates.push({ id: a.id, add: monthly });
  }

  if (lines.length === 0) {
    throw new Error("Tidak ada penyusutan untuk diposting.");
  }

  await createPostedFinanceJournal({
    entryDate: lastDayOfMonth(data.year, data.month),
    reference: `DEP-${data.year}-${String(data.month).padStart(2, "0")}`,
    memo: `Penyusutan bulanan ${data.year}-${data.month}`,
    lines: lines.map((l) => ({
      accountId: l.accountId,
      debit: l.debit,
      credit: l.credit,
      memo: l.memo,
      brandId: null,
    })),
  });

  for (const u of updates) {
    const row = await prisma.financeFixedAsset.findUniqueOrThrow({
      where: { id: u.id },
    });
    await prisma.financeFixedAsset.update({
      where: { id: u.id },
      data: {
        accumulatedDepreciation: row.accumulatedDepreciation.plus(u.add),
      },
    });
  }

  paths();
}

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0, 12, 0, 0, 0);
}

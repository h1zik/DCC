"use server";

import { FinanceDepreciationMethod, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth-helpers";
import { createPostedEntryInTx } from "@/lib/finance-journal-post";
import { ensurePeriodOpen } from "@/lib/finance-period-lock";
import {
  nonNegativeMoneyString,
  positiveMoneyString,
  toDecimal,
} from "@/lib/finance-money";

function paths() {
  revalidatePath("/finance/fixed-assets");
}

const assetSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(120).optional().nullable(),
  purchaseDate: z.coerce.date(),
  cost: positiveMoneyString,
  salvageValue: nonNegativeMoneyString.optional().default("0"),
  usefulLifeMonths: z.number().int().min(1).max(600),
  method: z.nativeEnum(FinanceDepreciationMethod).optional(),
  assetAccountId: z.string().min(1),
  accumAccountId: z.string().min(1),
  expenseAccountId: z.string().min(1),
});

export async function createFinanceFixedAsset(input: z.infer<typeof assetSchema>) {
  await requireFinance();
  const data = assetSchema.parse(input);
  const cost = toDecimal(data.cost);
  const salvageValue = toDecimal(data.salvageValue);
  if (salvageValue.gt(cost)) {
    throw new Error("Nilai sisa tidak boleh melebihi harga perolehan.");
  }
  await prisma.financeFixedAsset.create({
    data: {
      name: data.name.trim(),
      category: data.category?.trim() || null,
      purchaseDate: data.purchaseDate,
      cost,
      salvageValue,
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
  year: z.number().int().min(2000).max(2200),
  month: z.number().int().min(1).max(12),
});

/**
 * Penyusutan garis lurus per bulan; satu jurnal gabungan untuk semua aset
 * aktif. Idempoten per (tahun, bulan): dijalankan dua kali tidak menggandakan
 * beban — run kedua ditolak. Jurnal + update akumulasi = satu transaksi.
 */
export async function postFinanceDepreciationForMonth(
  input: z.infer<typeof depSchema>,
) {
  const session = await requireFinance();
  const data = depSchema.parse(input);
  const reference = `DEP-${data.year}-${String(data.month).padStart(2, "0")}`;
  const entryDate = lastDayOfMonth(data.year, data.month);

  await prisma.$transaction(async (tx) => {
    // Serialisasi run bulan yang sama (advisory lock rilis saat commit),
    // lalu tolak bila jurnal depresiasi periode ini sudah pernah diposting.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${reference}))`;
    const already = await tx.financeJournalEntry.findFirst({
      where: { reference, status: "POSTED" },
      select: { id: true, entryNumber: true },
    });
    if (already) {
      throw new Error(
        `Depresiasi ${reference} sudah diposting (${already.entryNumber ?? already.id.slice(0, 8)}). Balik jurnalnya dulu bila perlu posting ulang.`,
      );
    }

    await ensurePeriodOpen(entryDate, tx);

    const assets = await tx.financeFixedAsset.findMany({
      where: {
        disposedAt: null,
        purchaseDate: { lte: entryDate },
      },
    });

    const lines: {
      accountId: string;
      debit: string;
      credit: string;
      memo: string;
      brandId: null;
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
      // Satu nilai 2 desimal untuk jurnal DAN register — dulu register
      // menambah nilai belum-dibulatkan sehingga dua pembulatan bisa beda.
      monthly = monthly.toDecimalPlaces(2);
      if (monthly.lte(0)) continue;

      const m = monthly.toFixed(2);
      lines.push({
        accountId: a.expenseAccountId,
        debit: m,
        credit: "0",
        memo: `Depresiasi ${a.name}`,
        brandId: null,
      });
      lines.push({
        accountId: a.accumAccountId,
        debit: "0",
        credit: m,
        memo: `Akumulasi ${a.name}`,
        brandId: null,
      });
      updates.push({ id: a.id, add: monthly });
    }

    if (lines.length === 0) {
      throw new Error("Tidak ada penyusutan untuk diposting.");
    }

    await createPostedEntryInTx(tx, {
      entryDate,
      reference,
      memo: `Penyusutan bulanan ${data.year}-${data.month}`,
      createdById: session.user.id,
      lines,
    });

    for (const u of updates) {
      await tx.financeFixedAsset.update({
        where: { id: u.id },
        data: { accumulatedDepreciation: { increment: u.add } },
      });
    }
  });

  paths();
}

function lastDayOfMonth(year: number, month: number): Date {
  // Siang UTC hari terakhir bulan — deterministik lintas TZ server.
  return new Date(Date.UTC(year, month, 0, 12, 0, 0, 0));
}

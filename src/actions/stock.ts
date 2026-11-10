"use server";

import { revalidatePath, updateTag } from "next/cache";
import { Prisma, StockLogType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLogisticsStaff } from "@/lib/auth-helpers";
import {
  SALES_CATEGORY_LABELS,
  isSystemStockLog,
  parseSystemMeta,
} from "@/lib/stock-log-utils";
import {
  createStockNotices,
  describeStockMovement,
  notifyFinanceStockMovement,
  settlePriorStockNotice,
} from "@/lib/finance-stock-notice";
import { EXEC_DASHBOARD_TAG } from "@/lib/executive-dashboard-tag";

const salesCategorySchema = z.enum(["penjualan", "sampling", "retur", "rusak"]);

const logSchema = z.object({
  productId: z.string().min(1),
  amount: z.coerce.number().int().positive(),
  type: z.nativeEnum(StockLogType),
  salesCategory: salesCategorySchema.optional().nullable(),
  note: z.string().optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
  vendorId: z.string().optional().nullable(),
});

const updateLogSchema = z.object({
  logId: z.string().min(1),
  amount: z.coerce.number().int().positive(),
  type: z.nativeEnum(StockLogType),
  salesCategory: salesCategorySchema.optional().nullable(),
  note: z.string().optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
  reason: z.string().min(3).max(300),
});

const deleteLogSchema = z.object({
  logId: z.string().min(1),
  reason: z.string().min(3).max(300),
});

const adjustStockSchema = z.object({
  productId: z.string().min(1),
  targetStock: z.coerce.number().int().min(0),
  reason: z.string().min(3).max(300),
});

function actorSuffix(name: string | null | undefined): string {
  return name?.trim() ? ` · oleh ${name.trim()}` : "";
}

function deltaOf(type: StockLogType, amount: number): number {
  return type === StockLogType.IN ? amount : -amount;
}

function oppositeType(type: StockLogType): StockLogType {
  return type === StockLogType.IN ? StockLogType.OUT : StockLogType.IN;
}

type EffectiveState = {
  voided: boolean;
  amount: number;
  type: StockLogType;
  salesCategory: string | null;
};

/**
 * Kondisi TERKINI sebuah mutasi setelah rantai koreksi/void.
 * Reversal harus membalik nilai efektif — bukan nilai asli — kalau tidak,
 * koreksi kedua akan membalik jumlah asli untuk kedua kalinya dan
 * `currentStock` melenceng dari ledger.
 */
async function resolveEffectiveState(
  tx: Prisma.TransactionClient,
  log: {
    id: string;
    productId: string;
    amount: number;
    type: StockLogType;
    salesCategory: string | null;
  },
): Promise<EffectiveState> {
  const corrections = await tx.stockLog.findMany({
    where: { productId: log.productId, note: { startsWith: "[SYS]" } },
    orderBy: { createdAt: "asc" },
    select: {
      amount: true,
      type: true,
      salesCategory: true,
      note: true,
    },
  });

  const state: EffectiveState = {
    voided: false,
    amount: log.amount,
    type: log.type,
    salesCategory: log.salesCategory,
  };

  for (const row of corrections) {
    const meta = parseSystemMeta(row);
    if (meta.targetId !== log.id) continue;
    if (meta.action === "VOID") {
      state.voided = true;
      continue;
    }
    if (meta.action === "REPLACEMENT") {
      state.amount = row.amount;
      state.type = row.type;
      state.salesCategory = row.salesCategory;
    }
  }

  return state;
}

function buildSystemNote(params: {
  action: "REVERSAL" | "REPLACEMENT" | "VOID";
  targetLogId: string;
  reason: string;
  extraNote?: string | null;
}): string {
  const extra = (params.extraNote ?? "").trim();
  return [
    "[SYS]",
    `action=${params.action}`,
    `target=${params.targetLogId}`,
    `reason=${params.reason.trim()}`,
    ...(extra ? [`note=${extra}`] : []),
  ].join(" | ");
}

export async function createStockLog(input: z.infer<typeof logSchema>) {
  const session = await requireLogisticsStaff();
  const data = logSchema.parse(input);

  const productInfo = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: data.productId },
    });
    const salesCategory = data.salesCategory ?? null;
    if (data.type === StockLogType.OUT && !salesCategory) {
      throw new Error("Kategori stok keluar wajib dipilih.");
    }

    const delta = data.type === StockLogType.IN ? data.amount : -data.amount;
    const next = product.currentStock + delta;
    if (next < 0) {
      throw new Error("Stok tidak mencukupi untuk transaksi keluar.");
    }

    const created = await tx.stockLog.create({
      data: {
        productId: data.productId,
        amount: data.amount,
        type: data.type,
        salesCategory: data.type === StockLogType.OUT ? salesCategory : null,
        note: data.note ?? undefined,
        reference: data.reference?.trim() || undefined,
        vendorId:
          data.type === StockLogType.IN && data.vendorId ? data.vendorId : undefined,
        createdById: session.user.id,
      },
    });

    await createStockNotices(tx, [created.id]);

    await tx.product.update({
      where: { id: data.productId },
      data: { currentStock: next },
    });
    return { name: product.name, sku: product.sku };
  });

  const category =
    data.type === StockLogType.OUT && data.salesCategory
      ? ` · ${SALES_CATEGORY_LABELS[data.salesCategory] ?? data.salesCategory}`
      : "";
  await notifyFinanceStockMovement(
    `Barang ${describeStockMovement({
      type: data.type,
      amount: data.amount,
      productName: productInfo.name,
      sku: productInfo.sku,
    })}${category}${actorSuffix(session.user.name)} — menunggu dicatat.`,
  );

  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/");
  updateTag(EXEC_DASHBOARD_TAG);
}

export async function adjustProductStock(input: z.infer<typeof adjustStockSchema>) {
  const session = await requireLogisticsStaff();
  const data = adjustStockSchema.parse(input);

  const adjusted = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: data.productId },
    });
    const diff = data.targetStock - product.currentStock;
    if (diff === 0) return null;

    let created: { id: string };
    if (diff > 0) {
      created = await tx.stockLog.create({
        data: {
          productId: product.id,
          amount: diff,
          type: StockLogType.IN,
          note: `Penyesuaian inventori: ${data.reason.trim()}`,
          createdById: session.user.id,
        },
      });
    } else {
      created = await tx.stockLog.create({
        data: {
          productId: product.id,
          amount: Math.abs(diff),
          type: StockLogType.OUT,
          salesCategory: "rusak",
          note: `Penyesuaian inventori: ${data.reason.trim()}`,
          createdById: session.user.id,
        },
      });
    }

    await createStockNotices(tx, [created.id]);

    await tx.product.update({
      where: { id: product.id },
      data: { currentStock: data.targetStock },
    });
    return { diff, name: product.name, sku: product.sku };
  });

  if (adjusted) {
    await notifyFinanceStockMovement(
      `Penyesuaian stok: ${describeStockMovement({
        type: adjusted.diff > 0 ? StockLogType.IN : StockLogType.OUT,
        amount: Math.abs(adjusted.diff),
        productName: adjusted.name,
        sku: adjusted.sku,
      })} (${data.reason.trim()})${actorSuffix(session.user.name)} — menunggu dicatat.`,
    );
  }

  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/");
  updateTag(EXEC_DASHBOARD_TAG);
}

export async function updateStockLog(input: z.infer<typeof updateLogSchema>) {
  const session = await requireLogisticsStaff();
  const data = updateLogSchema.parse(input);

  const corrected = await prisma.$transaction(async (tx) => {
    const log = await tx.stockLog.findUniqueOrThrow({
      where: { id: data.logId },
      include: {
        product: { select: { id: true, currentStock: true, name: true, sku: true } },
      },
    });
    if (isSystemStockLog(log.note)) {
      throw new Error("Mutasi sistem tidak dapat dikoreksi ulang langsung.");
    }
    const salesCategory = data.salesCategory ?? null;
    if (data.type === StockLogType.OUT && !salesCategory) {
      throw new Error("Kategori stok keluar wajib dipilih.");
    }

    const effective = await resolveEffectiveState(tx, log);
    if (effective.voided) {
      throw new Error("Mutasi ini sudah di-void, tidak bisa dikoreksi lagi.");
    }

    const reversalType = oppositeType(effective.type);
    const reversalDelta = deltaOf(reversalType, effective.amount);
    const replacementDelta = deltaOf(data.type, data.amount);
    const nextStock = log.product.currentStock + reversalDelta + replacementDelta;
    if (nextStock < 0) {
      throw new Error("Koreksi membuat stok negatif. Cek jumlah koreksi.");
    }

    // Harus sebelum baris koreksi dibuat — lihat settlePriorStockNotice.
    const prior = await settlePriorStockNotice(tx, {
      id: log.id,
      productId: log.product.id,
    });

    const reversal = await tx.stockLog.create({
      data: {
        productId: log.product.id,
        amount: effective.amount,
        type: reversalType,
        salesCategory:
          reversalType === StockLogType.OUT
            ? effective.salesCategory ?? "penjualan"
            : null,
        note: buildSystemNote({
          action: "REVERSAL",
          targetLogId: log.id,
          reason: data.reason,
        }),
        createdById: session.user.id,
      },
    });
    const replacement = await tx.stockLog.create({
      data: {
        productId: log.product.id,
        amount: data.amount,
        type: data.type,
        salesCategory: data.type === StockLogType.OUT ? salesCategory : null,
        note: buildSystemNote({
          action: "REPLACEMENT",
          targetLogId: log.id,
          reason: data.reason,
          extraNote: data.note,
        }),
        reference: data.reference?.trim() || undefined,
        createdById: session.user.id,
      },
    });
    // Pembalik hanya perlu sampai ke Finance bila nilai lama sudah dijurnal.
    await createStockNotices(tx, [
      ...(prior.hadJournal ? [reversal.id] : []),
      replacement.id,
    ]);
    await tx.product.update({
      where: { id: log.product.id },
      data: { currentStock: nextStock },
    });
    return {
      name: log.product.name,
      sku: log.product.sku,
      hadJournal: prior.hadJournal,
    };
  });

  await notifyFinanceStockMovement(
    `Koreksi mutasi stok → ${describeStockMovement({
      type: data.type,
      amount: data.amount,
      productName: corrected.name,
      sku: corrected.sku,
    })} (${data.reason.trim()})${actorSuffix(session.user.name)}${
      corrected.hadJournal ? " — pencatatan lama perlu dibalik." : " — menunggu dicatat."
    }`,
  );

  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/");
  updateTag(EXEC_DASHBOARD_TAG);
}

export async function deleteStockLog(input: z.infer<typeof deleteLogSchema>) {
  const session = await requireLogisticsStaff();
  const data = deleteLogSchema.parse(input);

  const voided = await prisma.$transaction(async (tx) => {
    const log = await tx.stockLog.findUniqueOrThrow({
      where: { id: data.logId },
      include: {
        product: { select: { id: true, currentStock: true, name: true, sku: true } },
      },
    });
    if (isSystemStockLog(log.note)) {
      throw new Error("Mutasi sistem tidak dapat di-void langsung.");
    }
    const effective = await resolveEffectiveState(tx, log);
    if (effective.voided) {
      throw new Error("Mutasi ini sudah di-void.");
    }
    const reversalType = oppositeType(effective.type);
    const reversalDelta = deltaOf(reversalType, effective.amount);
    const nextStock = log.product.currentStock + reversalDelta;
    if (nextStock < 0) {
      throw new Error(
        "Mutasi ini tidak bisa di-void karena stok saat ini akan menjadi negatif.",
      );
    }

    // Harus sebelum baris void dibuat — lihat settlePriorStockNotice.
    const prior = await settlePriorStockNotice(tx, {
      id: log.id,
      productId: log.product.id,
    });

    const voidRow = await tx.stockLog.create({
      data: {
        productId: log.product.id,
        amount: effective.amount,
        type: reversalType,
        salesCategory:
          reversalType === StockLogType.OUT
            ? effective.salesCategory ?? "penjualan"
            : null,
        note: buildSystemNote({
          action: "VOID",
          targetLogId: log.id,
          reason: data.reason,
        }),
        createdById: session.user.id,
      },
    });
    // Mutasi yang belum dijurnal cukup hilang dari antrean; yang sudah
    // dijurnal butuh notice agar Finance membalik pencatatannya.
    if (prior.hadJournal) await createStockNotices(tx, [voidRow.id]);
    await tx.product.update({
      where: { id: log.product.id },
      data: { currentStock: nextStock },
    });
    return {
      hadJournal: prior.hadJournal,
      type: effective.type,
      amount: effective.amount,
      name: log.product.name,
      sku: log.product.sku,
    };
  });

  if (voided.hadJournal) {
    await notifyFinanceStockMovement(
      `Mutasi stok di-void: ${describeStockMovement({
        type: voided.type,
        amount: voided.amount,
        productName: voided.name,
        sku: voided.sku,
      })} (${data.reason.trim()})${actorSuffix(session.user.name)} — pencatatan perlu dibalik.`,
    );
  }

  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/");
  updateTag(EXEC_DASHBOARD_TAG);
}

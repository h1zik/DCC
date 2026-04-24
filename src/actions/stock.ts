"use server";

import { revalidatePath } from "next/cache";
import { StockLogType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLogisticsStaff } from "@/lib/auth-helpers";

const salesCategorySchema = z.enum(["penjualan", "sampling"]);

const logSchema = z.object({
  productId: z.string().min(1),
  amount: z.coerce.number().int().positive(),
  type: z.nativeEnum(StockLogType),
  salesCategory: salesCategorySchema.optional().nullable(),
  note: z.string().optional().nullable(),
});
const updateLogSchema = z.object({
  logId: z.string().min(1),
  amount: z.coerce.number().int().positive(),
  type: z.nativeEnum(StockLogType),
  salesCategory: salesCategorySchema.optional().nullable(),
  note: z.string().optional().nullable(),
  reason: z.string().min(3).max(300),
});
const deleteLogSchema = z.object({
  logId: z.string().min(1),
  reason: z.string().min(3).max(300),
});

function deltaOf(type: StockLogType, amount: number): number {
  return type === StockLogType.IN ? amount : -amount;
}

function oppositeType(type: StockLogType): StockLogType {
  return type === StockLogType.IN ? StockLogType.OUT : StockLogType.IN;
}

function isSystemStockLog(note: string | null): boolean {
  return (note ?? "").startsWith("[SYS]");
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
  await requireLogisticsStaff();
  const data = logSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: data.productId },
    });
    const salesCategory = data.salesCategory ?? null;
    if (data.type === StockLogType.OUT && !salesCategory) {
      throw new Error("Kategori stok keluar wajib dipilih (penjualan/sampling).");
    }

    const delta = data.type === StockLogType.IN ? data.amount : -data.amount;
    const next = product.currentStock + delta;
    if (next < 0) {
      throw new Error("Stok tidak mencukupi untuk transaksi keluar.");
    }

    await tx.stockLog.create({
      data: {
        productId: data.productId,
        amount: data.amount,
        type: data.type,
        salesCategory: data.type === StockLogType.OUT ? salesCategory : null,
        note: data.note ?? undefined,
      },
    });

    await tx.product.update({
      where: { id: data.productId },
      data: { currentStock: next },
    });
  });

  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/");
}

export async function updateStockLog(input: z.infer<typeof updateLogSchema>) {
  await requireLogisticsStaff();
  const data = updateLogSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    const log = await tx.stockLog.findUniqueOrThrow({
      where: { id: data.logId },
      include: { product: { select: { id: true, currentStock: true } } },
    });
    if (isSystemStockLog(log.note)) {
      throw new Error("Mutasi sistem tidak dapat dikoreksi ulang langsung.");
    }
    const salesCategory = data.salesCategory ?? null;
    if (data.type === StockLogType.OUT && !salesCategory) {
      throw new Error("Kategori stok keluar wajib dipilih (penjualan/sampling).");
    }

    // Append-only correction: simpan jejak dengan entri pembalik + entri pengganti.
    const reversalType = oppositeType(log.type);
    const reversalDelta = deltaOf(reversalType, log.amount);
    const replacementDelta = deltaOf(data.type, data.amount);
    const nextStock = log.product.currentStock + reversalDelta + replacementDelta;
    if (nextStock < 0) {
      throw new Error("Koreksi membuat stok negatif. Cek jumlah koreksi.");
    }

    await tx.stockLog.create({
      data: {
        productId: log.product.id,
        amount: log.amount,
        type: reversalType,
        salesCategory:
          reversalType === StockLogType.OUT ? log.salesCategory ?? "penjualan" : null,
        note: buildSystemNote({
          action: "REVERSAL",
          targetLogId: log.id,
          reason: data.reason,
        }),
      },
    });
    await tx.stockLog.create({
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
      },
    });
    await tx.product.update({
      where: { id: log.product.id },
      data: { currentStock: nextStock },
    });
  });

  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/");
}

export async function deleteStockLog(input: z.infer<typeof deleteLogSchema>) {
  await requireLogisticsStaff();
  const data = deleteLogSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    const log = await tx.stockLog.findUniqueOrThrow({
      where: { id: data.logId },
      include: { product: { select: { id: true, currentStock: true } } },
    });
    if (isSystemStockLog(log.note)) {
      throw new Error("Mutasi sistem tidak dapat di-void langsung.");
    }
    const reversalType = oppositeType(log.type);
    const reversalDelta = deltaOf(reversalType, log.amount);
    const nextStock = log.product.currentStock + reversalDelta;
    if (nextStock < 0) {
      throw new Error(
        "Mutasi ini tidak bisa di-void karena stok saat ini akan menjadi negatif.",
      );
    }

    await tx.stockLog.create({
      data: {
        productId: log.product.id,
        amount: log.amount,
        type: reversalType,
        salesCategory:
          reversalType === StockLogType.OUT ? log.salesCategory ?? "penjualan" : null,
        note: buildSystemNote({
          action: "VOID",
          targetLogId: log.id,
          reason: data.reason,
        }),
      },
    });
    await tx.product.update({
      where: { id: log.product.id },
      data: { currentStock: nextStock },
    });
  });

  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/");
}

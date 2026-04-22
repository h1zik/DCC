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

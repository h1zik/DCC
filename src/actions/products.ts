"use server";

import { revalidatePath } from "next/cache";
import { PipelineStage, ProductVendorRole, Prisma, StockLogType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLogisticsStaff } from "@/lib/auth-helpers";
import { primaryPreferredVendorId } from "@/lib/product-vendor";
import {
  computeProductReorderForecast,
  forecastProductInclude,
  loadSalesTotalsByProduct,
  toForecastProductInput,
} from "@/lib/reorder-forecast";

const productVendorLinkSchema = z.object({
  vendorId: z.string().min(1),
  role: z.nativeEnum(ProductVendorRole),
  roleLabel: z.string().optional().nullable(),
  leadTimeDaysOverride: z.coerce.number().int().min(0).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const productBaseSchema = z.object({
  brandId: z.string().min(1),
  name: z.string().min(1),
  sku: z.string().min(1),
  minStock: z.coerce.number().int().min(0),
  category: z.string().optional().nullable(),
  pipelineStage: z.nativeEnum(PipelineStage),
  preferredVendorId: z.string().optional().nullable(),
  leadTimeDaysOverride: z.coerce.number().int().min(0).optional().nullable(),
  safetyStockDaysOverride: z.coerce.number().int().min(0).optional().nullable(),
  productVendors: z.array(productVendorLinkSchema).optional(),
});

const createProductSchema = productBaseSchema.extend({
  openingStock: z.coerce.number().int().min(0).default(0),
});

const updateProductSchema = productBaseSchema;

const applyReorderSchema = z.object({
  productId: z.string().min(1),
  windowDays: z.coerce.number().int().min(30).max(90).optional(),
});

async function syncProductVendors(
  tx: Prisma.TransactionClient,
  productId: string,
  links: z.infer<typeof productVendorLinkSchema>[] | undefined,
  preferredVendorId: string | null | undefined,
) {
  const normalized =
    links && links.length > 0
      ? links.map((link, index) => ({
          vendorId: link.vendorId,
          role: link.role,
          roleLabel: link.roleLabel?.trim() || null,
          leadTimeDaysOverride: link.leadTimeDaysOverride ?? null,
          sortOrder: link.sortOrder ?? index,
        }))
      : [];

  await tx.productVendor.deleteMany({ where: { productId } });

  if (normalized.length > 0) {
    await tx.productVendor.createMany({
      data: normalized.map((link) => ({
        productId,
        ...link,
      })),
    });
  }

  const resolvedPreferred =
    preferredVendorId ||
    (normalized.length > 0 ? primaryPreferredVendorId(normalized) : null);

  await tx.product.update({
    where: { id: productId },
    data: { preferredVendorId: resolvedPreferred },
  });
}

async function loadForecastProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      brand: { select: { name: true } },
      ...forecastProductInclude,
    },
  });
  if (!product) return null;
  return toForecastProductInput(product);
}

export async function createProduct(input: z.infer<typeof createProductSchema>) {
  const session = await requireLogisticsStaff();
  const data = createProductSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        brandId: data.brandId,
        name: data.name,
        sku: data.sku,
        currentStock: 0,
        minStock: data.minStock,
        category: data.category ?? undefined,
        pipelineStage: data.pipelineStage,
        preferredVendorId: data.preferredVendorId || undefined,
        leadTimeDaysOverride: data.leadTimeDaysOverride ?? undefined,
        safetyStockDaysOverride: data.safetyStockDaysOverride ?? undefined,
      },
    });

    await syncProductVendors(
      tx,
      product.id,
      data.productVendors,
      data.preferredVendorId,
    );

    if (data.openingStock > 0) {
      await tx.stockLog.create({
        data: {
          productId: product.id,
          amount: data.openingStock,
          type: StockLogType.IN,
          note: "Saldo awal produk",
          createdById: session.user.id,
        },
      });
      await tx.product.update({
        where: { id: product.id },
        data: { currentStock: data.openingStock },
      });
    }
  });

  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/inventory");
}

export async function updateProduct(
  id: string,
  input: z.infer<typeof updateProductSchema>,
) {
  await requireLogisticsStaff();
  const data = updateProductSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        brandId: data.brandId,
        name: data.name,
        minStock: data.minStock,
        category: data.category ?? undefined,
        pipelineStage: data.pipelineStage,
        leadTimeDaysOverride: data.leadTimeDaysOverride ?? null,
        safetyStockDaysOverride: data.safetyStockDaysOverride ?? null,
      },
    });

    await syncProductVendors(tx, id, data.productVendors, data.preferredVendorId);
  });

  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/inventory");
}

export async function applySuggestedReorderPoint(
  input: z.infer<typeof applyReorderSchema>,
) {
  await requireLogisticsStaff();
  const data = applyReorderSchema.parse(input);
  const windowDays = data.windowDays ?? 90;

  const product = await loadForecastProduct(data.productId);
  if (!product) throw new Error("Produk tidak ditemukan.");

  const sales = await loadSalesTotalsByProduct([product.id], windowDays);
  const forecast = computeProductReorderForecast(product, sales, windowDays);

  if (forecast.reorderPoint == null) {
    throw new Error(
      forecast.status === "NO_LEAD_TIME"
        ? "Set lead time semua vendor rantai pasok atau override SKU terlebih dahulu."
        : "Belum cukup data penjualan untuk menghitung ROP.",
    );
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { minStock: forecast.reorderPoint },
  });

  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/");

  return { appliedMinStock: forecast.reorderPoint };
}

export async function deleteProduct(id: string) {
  await requireLogisticsStaff();
  await prisma.product.delete({ where: { id } });
  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/inventory");
}

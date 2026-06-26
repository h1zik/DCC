"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { ResearchMarketplace } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import {
  detectMarketplaceFromProductUrl,
  validateCompetitorProductUrl,
} from "@/lib/research/detect-product-marketplace";
import {
  enqueueCategoryProductScrapes,
  enqueueCompetitorProductTrackScrape,
} from "@/lib/research/scrape-competitor-product";

const createCategorySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

const addProductSchema = z.object({
  categoryId: z.string().min(1),
  productUrl: z.string().url(),
  marketplace: z.nativeEnum(ResearchMarketplace).optional(),
});

function revalidateProductPaths(categoryId: string, trackId?: string) {
  // The same product data model is surfaced under BOTH research-hub and brand-hub,
  // so invalidate both prefixes — otherwise the brand-hub product pages stay stale.
  for (const base of [
    "/research-hub/competitor-tracker/products",
    "/brand-hub/competitor-tracker/products",
  ]) {
    revalidatePath(base);
    revalidatePath(`${base}/${categoryId}`);
    if (trackId) {
      revalidatePath(`${base}/${categoryId}/tracks/${trackId}`);
    }
  }
}

export async function createCompetitorProductCategory(
  input: z.infer<typeof createCategorySchema>,
) {
  const session = await requireMarketAnalyst();
  const data = createCategorySchema.parse(input);

  const category = await prisma.competitorProductCategory.create({
    data: {
      name: data.name,
      description: data.description?.trim() || null,
      createdById: session.user.id,
    },
  });

  revalidateProductPaths(category.id);
  return { id: category.id };
}

export async function addCompetitorProductTrack(
  input: z.infer<typeof addProductSchema>,
  options?: { background?: boolean },
) {
  await requireMarketAnalyst();
  const data = addProductSchema.parse(input);

  const category = await prisma.competitorProductCategory.findUnique({
    where: { id: data.categoryId },
  });
  if (!category) throw new Error("Kategori tidak ditemukan.");

  const marketplace =
    data.marketplace ?? detectMarketplaceFromProductUrl(data.productUrl);
  if (!marketplace) {
    throw new Error(
      "Marketplace tidak dikenali dari URL. Pilih Shopee, Tokopedia, Lazada, atau TikTok Shop.",
    );
  }

  const urlError = validateCompetitorProductUrl(data.productUrl, marketplace);
  if (urlError) throw new Error(urlError);

  const existing = await prisma.competitorProductTrack.findUnique({
    where: {
      categoryId_productUrl: {
        categoryId: data.categoryId,
        productUrl: data.productUrl.trim(),
      },
    },
  });
  if (existing) {
    throw new Error("URL produk ini sudah ada di kategori.");
  }

  const track = await prisma.competitorProductTrack.create({
    data: {
      categoryId: data.categoryId,
      productUrl: data.productUrl.trim(),
      marketplace,
      name: "Memuat data produk…",
    },
  });

  if (options?.background) {
    // Jalankan scrape di latar belakang supaya response cepat dan user
    // bisa langsung navigasi bebas (dipakai oleh flow Product Discovery).
    after(async () => {
      try {
        await enqueueCompetitorProductTrackScrape(track.id);
      } catch (err) {
        console.error(
          "[addCompetitorProductTrack] background scrape gagal",
          err,
        );
      }
    });
  } else {
    try {
      await enqueueCompetitorProductTrackScrape(track.id);
    } catch (err) {
      console.error("[addCompetitorProductTrack] scrape gagal", err);
      throw err;
    }
  }

  revalidateProductPaths(data.categoryId, track.id);
  return { id: track.id };
}

export async function refreshCompetitorProductTrack(trackId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(trackId);

  const track = await prisma.competitorProductTrack.findUnique({
    where: { id: trackId },
    select: { categoryId: true },
  });
  if (!track) throw new Error("Produk tidak ditemukan.");

  after(async () => {
    try {
      await enqueueCompetitorProductTrackScrape(trackId);
    } catch (err) {
      console.error("[refreshCompetitorProductTrack] gagal", err);
    }
  });

  revalidateProductPaths(track.categoryId, trackId);
}

export async function refreshCompetitorProductCategory(categoryId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(categoryId);

  after(async () => {
    try {
      await enqueueCategoryProductScrapes(categoryId);
    } catch (err) {
      console.error("[refreshCompetitorProductCategory] gagal", err);
    }
  });

  revalidateProductPaths(categoryId);
}

export async function deleteCompetitorProductTrack(trackId: string) {
  await requireMarketAnalyst();
  const track = await prisma.competitorProductTrack.findUnique({
    where: { id: trackId },
    select: { categoryId: true },
  });
  if (!track) return;

  await prisma.competitorProductTrack.delete({ where: { id: trackId } });
  revalidateProductPaths(track.categoryId);
}

export async function deleteCompetitorProductCategory(categoryId: string) {
  await requireMarketAnalyst();
  await prisma.competitorProductCategory.delete({ where: { id: categoryId } });
  revalidateProductPaths(categoryId);
}

export async function markCompetitorProductAlertRead(alertId: string) {
  await requireMarketAnalyst();
  const alert = await prisma.competitorProductAlert.update({
    where: { id: alertId },
    data: { isRead: true },
    select: { categoryId: true },
  });
  revalidateProductPaths(alert.categoryId);
}

export async function markAllCompetitorProductAlertsRead(categoryId: string) {
  await requireMarketAnalyst();
  await prisma.competitorProductAlert.updateMany({
    where: { categoryId, isRead: false },
    data: { isRead: true },
  });
  revalidateProductPaths(categoryId);
}

export async function listCompetitorProductCategories() {
  await requireMarketAnalyst();
  return prisma.competitorProductCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

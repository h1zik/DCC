"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { ResearchMarketplace } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import { isShopeeProductUrl } from "@/lib/apify/shopee-url";
import { enqueueBrandCompetitorScrape } from "@/lib/brand-research/scrape-competitor";

const createCompetitorSchema = z
  .object({
    name: z.string().min(1).max(120),
    brand: z.string().min(1).max(120),
    category: z.string().min(1).max(120),
    marketplace: z.nativeEnum(ResearchMarketplace),
    shopUrl: z.string().url(),
  })
  .superRefine((data, ctx) => {
    if (
      data.marketplace === ResearchMarketplace.SHOPEE &&
      isShopeeProductUrl(data.shopUrl)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "URL toko Shopee diperlukan (bukan URL produk). Contoh: https://shopee.co.id/nama-toko",
        path: ["shopUrl"],
      });
    }
  });

export async function createBrandCompetitor(
  input: z.infer<typeof createCompetitorSchema>,
) {
  const session = await requireBrandManager();
  const data = createCompetitorSchema.parse(input);

  const competitor = await prisma.brandCompetitor.create({
    data: {
      name: data.name,
      brand: data.brand,
      category: data.category,
      marketplace: data.marketplace,
      shopUrl: data.shopUrl,
      createdById: session.user.id,
    },
  });

  after(async () => {
    try {
      await enqueueBrandCompetitorScrape(competitor.id);
    } catch (err) {
      console.error("[createBrandCompetitor] scrape gagal", err);
    }
  });

  revalidatePath("/brand-hub/competitor-tracker");
  revalidatePath(`/brand-hub/competitor-tracker/${competitor.id}`);
  return { id: competitor.id };
}

export async function refreshBrandCompetitor(competitorId: string) {
  await requireBrandManager();
  z.string().min(1).parse(competitorId);

  after(async () => {
    try {
      await enqueueBrandCompetitorScrape(competitorId);
    } catch (err) {
      console.error("[refreshBrandCompetitor] gagal", err);
    }
  });

  revalidatePath("/brand-hub/competitor-tracker");
  revalidatePath(`/brand-hub/competitor-tracker/${competitorId}`);
}

export async function toggleBrandCompetitorActive(
  competitorId: string,
  isActive: boolean,
) {
  await requireBrandManager();
  await prisma.brandCompetitor.update({
    where: { id: competitorId },
    data: { isActive },
  });
  revalidatePath("/brand-hub/competitor-tracker");
}

export async function markCompetitorAlertRead(alertId: string) {
  await requireBrandManager();
  await prisma.brandCompetitorAlert.update({
    where: { id: alertId },
    data: { isRead: true },
  });
  revalidatePath("/brand-hub/competitor-tracker");
}

export async function markAllCompetitorAlertsRead(competitorId: string) {
  await requireBrandManager();
  await prisma.brandCompetitorAlert.updateMany({
    where: { competitorId, isRead: false },
    data: { isRead: true },
  });
  revalidatePath(`/brand-hub/competitor-tracker/${competitorId}`);
}

export async function deleteBrandCompetitor(competitorId: string) {
  await requireBrandManager();
  await prisma.brandCompetitor.delete({ where: { id: competitorId } });
  revalidatePath("/brand-hub/competitor-tracker");
}

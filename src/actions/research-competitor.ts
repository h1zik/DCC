"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { ResearchMarketplace } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import { isShopeeProductUrl } from "@/lib/apify/shopee-url";
import { enqueueCompetitorScrape } from "@/lib/research/scrape-competitor";

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

export async function createResearchCompetitor(
  input: z.infer<typeof createCompetitorSchema>,
) {
  const session = await requireMarketAnalyst();
  const data = createCompetitorSchema.parse(input);

  const competitor = await prisma.researchCompetitor.create({
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
      await enqueueCompetitorScrape(competitor.id);
    } catch (err) {
      console.error("[createResearchCompetitor] scrape gagal", err);
    }
  });

  revalidatePath("/research-hub/competitor-tracker");
  revalidatePath(`/research-hub/competitor-tracker/${competitor.id}`);
  return { id: competitor.id };
}

export async function refreshResearchCompetitor(competitorId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(competitorId);

  after(async () => {
    try {
      await enqueueCompetitorScrape(competitorId);
    } catch (err) {
      console.error("[refreshResearchCompetitor] gagal", err);
    }
  });

  revalidatePath("/research-hub/competitor-tracker");
  revalidatePath(`/research-hub/competitor-tracker/${competitorId}`);
}

export async function toggleResearchCompetitorActive(
  competitorId: string,
  isActive: boolean,
) {
  await requireMarketAnalyst();
  await prisma.researchCompetitor.update({
    where: { id: competitorId },
    data: { isActive },
  });
  revalidatePath("/research-hub/competitor-tracker");
}

export async function markCompetitorAlertRead(alertId: string) {
  await requireMarketAnalyst();
  await prisma.competitorAlert.update({
    where: { id: alertId },
    data: { isRead: true },
  });
  revalidatePath("/research-hub/competitor-tracker");
}

export async function markAllCompetitorAlertsRead(competitorId: string) {
  await requireMarketAnalyst();
  await prisma.competitorAlert.updateMany({
    where: { competitorId, isRead: false },
    data: { isRead: true },
  });
  revalidatePath(`/research-hub/competitor-tracker/${competitorId}`);
}

export async function deleteResearchCompetitor(competitorId: string) {
  await requireMarketAnalyst();
  await prisma.researchCompetitor.delete({ where: { id: competitorId } });
  revalidatePath("/research-hub/competitor-tracker");
}

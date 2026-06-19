"use server";

import { revalidatePath } from "next/cache";
import { ResearchMarketplace } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import {
  completeReviewScrapeFromImportedReviews,
  enqueueReviewScrape,
} from "@/lib/research/scrape-review-source";
import {
  marketplaceForPlatformKey,
  validateReviewPlatformUrl,
  isReviewPlatformConfigured,
} from "@/lib/review-platforms/registry";
import { isReviewPlatformKey, platformKeyFromMarketplace } from "@/lib/review-platforms/platforms";
import {
  normalizeCompetitorSkuProductUrl,
  skuProductUrlCandidates,
} from "@/lib/research/competitor-review-link";
import { parseReviewCsv } from "@/lib/review-scrape/csv-import";
import {
  exportResearchReviewRawCsv,
  queryResearchReviewRawPage,
} from "@/lib/review-scrape/review-raw-query";
import type { ReviewRawPage } from "@/lib/review-scrape/review-raw-types";

const createSourceSchema = z.object({
  productName: z.string().min(1).max(200),
  competitorBrand: z.string().min(1).max(120),
  platformKey: z.string().min(1).max(64),
  /** @deprecated use platformKey */
  marketplace: z.nativeEnum(ResearchMarketplace).optional(),
  productUrl: z.string().url(),
  brandId: z.string().optional().nullable(),
});

const createFromCsvSchema = z.object({
  productName: z.string().min(1).max(200),
  competitorBrand: z.string().min(1).max(120),
  productUrl: z.string().url().optional().default("https://manual-import.local/reviews"),
  csvContent: z.string().min(1).max(2_000_000),
  brandId: z.string().optional().nullable(),
});

function resolvePlatformKey(input: {
  platformKey?: string;
  marketplace?: ResearchMarketplace;
}): string {
  if (input.platformKey && isReviewPlatformKey(input.platformKey)) {
    return input.platformKey;
  }
  if (input.marketplace) {
    switch (input.marketplace) {
      case ResearchMarketplace.SHOPEE:
        return "shopee";
      case ResearchMarketplace.TOKOPEDIA:
        return "tokopedia";
      case ResearchMarketplace.TIKTOK_SHOP:
        return "tiktok_shop";
    }
  }
  return "shopee";
}

export async function createReviewIntelSource(
  input: z.infer<typeof createSourceSchema>,
) {
  const session = await requireMarketAnalyst();
  const data = createSourceSchema.parse(input);
  const platformKey = resolvePlatformKey(data);

  if (platformKey === "csv") {
    throw new Error("Gunakan import CSV untuk platform Import CSV.");
  }

  const urlError = validateReviewPlatformUrl(platformKey, data.productUrl);
  if (urlError) throw new Error(urlError);

  const source = await prisma.reviewIntelSource.create({
    data: {
      productName: data.productName,
      competitorBrand: data.competitorBrand,
      platformKey,
      marketplace: marketplaceForPlatformKey(platformKey),
      productUrl: data.productUrl,
      brandId: data.brandId || null,
      createdById: session.user.id,
    },
  });

  try {
    await enqueueReviewScrape(source.id);
  } catch (err) {
    console.error("[createReviewIntelSource] enqueue scrape gagal", err);
    throw err;
  }

  revalidatePath("/research-hub/review-intelligence");
  revalidatePath(`/research-hub/review-intelligence/${source.id}`);
  return { id: source.id, status: "SCRAPING" as const };
}

/** Buat atau buka sumber Review Intelligence dari SKU Competitor Tracker. */
export async function createReviewIntelFromCompetitorSku(skuId: string) {
  const session = await requireMarketAnalyst();
  z.string().min(1).parse(skuId);

  const sku = await prisma.competitorSku.findUnique({
    where: { id: skuId },
    include: {
      competitor: {
        select: {
          id: true,
          brand: true,
          marketplace: true,
        },
      },
    },
  });

  if (!sku) throw new Error("SKU tidak ditemukan.");
  if (!sku.productUrl?.trim()) {
    throw new Error("SKU tidak memiliki URL produk.");
  }

  const { competitor } = sku;
  const platformKey = platformKeyFromMarketplace(competitor.marketplace);
  const productUrl = normalizeCompetitorSkuProductUrl(
    competitor.marketplace,
    sku.productUrl,
  );

  if (!isReviewPlatformConfigured(platformKey)) {
    throw new Error(
      `Platform review ${platformKey} belum dikonfigurasi. Cek env Apify di server.`,
    );
  }

  const urlError = validateReviewPlatformUrl(platformKey, productUrl);
  if (urlError) throw new Error(urlError);

  const urlCandidates = skuProductUrlCandidates(
    competitor.marketplace,
    sku.productUrl,
  );

  const existing = await prisma.reviewIntelSource.findFirst({
    where: { productUrl: { in: urlCandidates } },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    if (existing.status === "FAILED") {
      try {
        await enqueueReviewScrape(existing.id);
      } catch (err) {
        console.error(
          "[createReviewIntelFromCompetitorSku] rescrape gagal",
          err,
        );
        throw err;
      }
    }

    revalidatePath("/research-hub/review-intelligence");
    revalidatePath(`/research-hub/review-intelligence/${existing.id}`);
    revalidatePath("/research-hub/competitor-tracker");
    revalidatePath(`/research-hub/competitor-tracker/${competitor.id}`);

    return {
      id: existing.id,
      status: existing.status === "FAILED" ? ("SCRAPING" as const) : existing.status,
      created: false as const,
    };
  }

  const source = await prisma.reviewIntelSource.create({
    data: {
      productName: sku.name,
      competitorBrand: competitor.brand,
      platformKey,
      marketplace: marketplaceForPlatformKey(platformKey),
      productUrl,
      createdById: session.user.id,
    },
  });

  try {
    await enqueueReviewScrape(source.id);
  } catch (err) {
    console.error("[createReviewIntelFromCompetitorSku] enqueue gagal", err);
    throw err;
  }

  revalidatePath("/research-hub/review-intelligence");
  revalidatePath(`/research-hub/review-intelligence/${source.id}`);
  revalidatePath("/research-hub/competitor-tracker");
  revalidatePath(`/research-hub/competitor-tracker/${competitor.id}`);

  return { id: source.id, status: "SCRAPING" as const, created: true as const };
}

export async function createReviewIntelSourceFromCsv(
  input: z.infer<typeof createFromCsvSchema>,
) {
  const session = await requireMarketAnalyst();
  const data = createFromCsvSchema.parse(input);
  const reviews = parseReviewCsv(data.csvContent);

  const source = await prisma.reviewIntelSource.create({
    data: {
      productName: data.productName,
      competitorBrand: data.competitorBrand,
      platformKey: "csv",
      marketplace: null,
      productUrl: data.productUrl,
      brandId: data.brandId || null,
      createdById: session.user.id,
      status: "SCRAPING",
    },
  });

  try {
    await completeReviewScrapeFromImportedReviews(source.id, reviews);
  } catch (err) {
    await prisma.reviewIntelSource.delete({ where: { id: source.id } }).catch(() => {});
    throw err;
  }

  revalidatePath("/research-hub/review-intelligence");
  revalidatePath(`/research-hub/review-intelligence/${source.id}`);
  return { id: source.id, status: "READY" as const };
}

export async function rescrapeReviewIntelSource(sourceId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(sourceId);

  const source = await prisma.reviewIntelSource.findUnique({
    where: { id: sourceId },
    select: { platformKey: true },
  });
  if (source?.platformKey === "csv") {
    throw new Error("Sumber CSV tidak bisa di-scrape ulang. Import ulang file CSV.");
  }

  try {
    await enqueueReviewScrape(sourceId);
  } catch (err) {
    console.error("[rescrapeReviewIntelSource] gagal", err);
    throw err;
  }

  revalidatePath("/research-hub/review-intelligence");
  revalidatePath(`/research-hub/review-intelligence/${sourceId}`);
}

export async function pollReviewIntelJobs(): Promise<{ polled: number }> {
  await requireMarketAnalyst();
  const { pollReviewScrapeJobsLight } = await import(
    "@/lib/research/run-review-scrape-job"
  );
  const polled = await pollReviewScrapeJobsLight();
  return { polled };
}

export async function deleteReviewIntelSource(sourceId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(sourceId);

  await prisma.reviewIntelSource.delete({ where: { id: sourceId } });
  revalidatePath("/research-hub/review-intelligence");
}

export async function listReviewIntelSourcesForCompare(excludeId?: string) {
  await requireMarketAnalyst();
  return prisma.reviewIntelSource.findMany({
    where: {
      status: "READY",
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      productName: true,
      competitorBrand: true,
      summary: {
        select: {
          positivePct: true,
          neutralPct: true,
          negativePct: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
}

export async function getReviewIntelRawReviews(input: {
  sourceId: string;
  page?: number;
  search?: string;
}): Promise<ReviewRawPage> {
  await requireMarketAnalyst();
  const sourceId = z.string().min(1).parse(input.sourceId);

  const source = await prisma.reviewIntelSource.findUnique({
    where: { id: sourceId },
    select: { id: true },
  });
  if (!source) throw new Error("Sumber review tidak ditemukan.");

  return queryResearchReviewRawPage({
    sourceId,
    page: input.page,
    search: input.search,
  });
}

export async function exportReviewIntelRawReviewsCsv(
  sourceId: string,
  search?: string,
): Promise<string> {
  await requireMarketAnalyst();
  const id = z.string().min(1).parse(sourceId);

  const source = await prisma.reviewIntelSource.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!source) throw new Error("Sumber review tidak ditemukan.");

  return exportResearchReviewRawCsv(id, search);
}

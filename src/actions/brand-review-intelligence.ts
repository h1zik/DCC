"use server";

import { revalidatePath } from "next/cache";
import { ResearchMarketplace } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import {
  completeBrandReviewScrapeFromImportedReviews,
  enqueueBrandReviewScrape,
} from "@/lib/brand-research/scrape-review-source";
import {
  marketplaceForPlatformKey,
  validateReviewPlatformUrl,
} from "@/lib/review-platforms/registry";
import { isReviewPlatformKey } from "@/lib/review-platforms/platforms";
import { parseReviewCsv } from "@/lib/review-scrape/csv-import";
import {
  exportBrandReviewRawCsv,
  queryBrandReviewRawPage,
} from "@/lib/review-scrape/review-raw-query";
import type { ReviewRawPage } from "@/lib/review-scrape/review-raw-types";

const createSourceSchema = z.object({
  productName: z.string().min(1).max(200),
  competitorBrand: z.string().min(1).max(120),
  platformKey: z.string().min(1).max(64),
  marketplace: z.nativeEnum(ResearchMarketplace).optional(),
  productUrl: z.string().url(),
  ownerBrandId: z.string().optional().nullable(),
});

const createFromCsvSchema = z.object({
  productName: z.string().min(1).max(200),
  competitorBrand: z.string().min(1).max(120),
  productUrl: z.string().url().optional().default("https://manual-import.local/reviews"),
  csvContent: z.string().min(1).max(2_000_000),
  ownerBrandId: z.string().optional().nullable(),
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

export async function createBrandReviewIntelSource(
  input: z.infer<typeof createSourceSchema>,
) {
  const session = await requireBrandManager();
  const data = createSourceSchema.parse(input);
  const platformKey = resolvePlatformKey(data);

  if (platformKey === "csv") {
    throw new Error("Gunakan import CSV untuk platform Import CSV.");
  }

  const urlError = validateReviewPlatformUrl(platformKey, data.productUrl);
  if (urlError) throw new Error(urlError);

  const source = await prisma.brandReviewSource.create({
    data: {
      productName: data.productName,
      competitorBrand: data.competitorBrand,
      platformKey,
      marketplace: marketplaceForPlatformKey(platformKey),
      productUrl: data.productUrl,
      ownerBrandId: data.ownerBrandId || null,
      createdById: session.user.id,
    },
  });

  try {
    await enqueueBrandReviewScrape(source.id);
  } catch (err) {
    console.error("[createBrandReviewIntelSource] enqueue scrape gagal", err);
    throw err;
  }

  revalidatePath("/brand-hub/review-intelligence");
  revalidatePath(`/brand-hub/review-intelligence/${source.id}`);
  return { id: source.id, status: "SCRAPING" as const };
}

export async function createBrandReviewIntelSourceFromCsv(
  input: z.infer<typeof createFromCsvSchema>,
) {
  const session = await requireBrandManager();
  const data = createFromCsvSchema.parse(input);
  const reviews = parseReviewCsv(data.csvContent);

  const source = await prisma.brandReviewSource.create({
    data: {
      productName: data.productName,
      competitorBrand: data.competitorBrand,
      platformKey: "csv",
      marketplace: null,
      productUrl: data.productUrl,
      ownerBrandId: data.ownerBrandId || null,
      createdById: session.user.id,
      status: "SCRAPING",
    },
  });

  try {
    await completeBrandReviewScrapeFromImportedReviews(source.id, reviews);
  } catch (err) {
    await prisma.brandReviewSource.delete({ where: { id: source.id } }).catch(() => {});
    throw err;
  }

  revalidatePath("/brand-hub/review-intelligence");
  revalidatePath(`/brand-hub/review-intelligence/${source.id}`);
  return { id: source.id, status: "READY" as const };
}

export async function rescrapeBrandReviewIntelSource(sourceId: string) {
  await requireBrandManager();
  z.string().min(1).parse(sourceId);

  const source = await prisma.brandReviewSource.findUnique({
    where: { id: sourceId },
    select: { platformKey: true },
  });
  if (source?.platformKey === "csv") {
    throw new Error("Sumber CSV tidak bisa di-scrape ulang. Import ulang file CSV.");
  }

  try {
    await enqueueBrandReviewScrape(sourceId);
  } catch (err) {
    console.error("[rescrapeBrandReviewIntelSource] gagal", err);
    throw err;
  }

  revalidatePath("/brand-hub/review-intelligence");
  revalidatePath(`/brand-hub/review-intelligence/${sourceId}`);
}

export async function pollBrandReviewIntelJobs(): Promise<{ polled: number }> {
  await requireBrandManager();
  const { pollBrandReviewScrapeJobsLight } = await import(
    "@/lib/brand-research/run-review-scrape-job"
  );
  const polled = await pollBrandReviewScrapeJobsLight();
  return { polled };
}

export async function deleteBrandReviewIntelSource(sourceId: string) {
  await requireBrandManager();
  z.string().min(1).parse(sourceId);

  await prisma.brandReviewSource.delete({ where: { id: sourceId } });
  revalidatePath("/brand-hub/review-intelligence");
}

export async function listBrandReviewIntelSourcesForCompare(excludeId?: string) {
  await requireBrandManager();
  return prisma.brandReviewSource.findMany({
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

export async function getBrandReviewRawReviews(input: {
  sourceId: string;
  page?: number;
  search?: string;
}): Promise<ReviewRawPage> {
  await requireBrandManager();
  const sourceId = z.string().min(1).parse(input.sourceId);

  const source = await prisma.brandReviewSource.findUnique({
    where: { id: sourceId },
    select: { id: true },
  });
  if (!source) throw new Error("Sumber review tidak ditemukan.");

  return queryBrandReviewRawPage({
    sourceId,
    page: input.page,
    search: input.search,
  });
}

export async function exportBrandReviewRawReviewsCsv(
  sourceId: string,
  search?: string,
): Promise<string> {
  await requireBrandManager();
  const id = z.string().min(1).parse(sourceId);

  const source = await prisma.brandReviewSource.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!source) throw new Error("Sumber review tidak ditemukan.");

  return exportBrandReviewRawCsv(id, search);
}

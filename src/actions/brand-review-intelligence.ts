"use server";

import { revalidatePath } from "next/cache";
import { ResearchMarketplace } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import { enqueueBrandReviewScrape } from "@/lib/brand-research/scrape-review-source";

const createSourceSchema = z.object({
  productName: z.string().min(1).max(200),
  competitorBrand: z.string().min(1).max(120),
  marketplace: z.nativeEnum(ResearchMarketplace),
  productUrl: z.string().url(),
  ownerBrandId: z.string().optional().nullable(),
});

export async function createBrandReviewIntelSource(
  input: z.infer<typeof createSourceSchema>,
) {
  const session = await requireBrandManager();
  const data = createSourceSchema.parse(input);

  const source = await prisma.brandReviewSource.create({
    data: {
      productName: data.productName,
      competitorBrand: data.competitorBrand,
      marketplace: data.marketplace,
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

export async function rescrapeBrandReviewIntelSource(sourceId: string) {
  await requireBrandManager();
  z.string().min(1).parse(sourceId);

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

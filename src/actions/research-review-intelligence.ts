"use server";

import { revalidatePath } from "next/cache";
import { ResearchMarketplace } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import { enqueueReviewScrape } from "@/lib/research/scrape-review-source";

const createSourceSchema = z.object({
  productName: z.string().min(1).max(200),
  competitorBrand: z.string().min(1).max(120),
  marketplace: z.nativeEnum(ResearchMarketplace),
  productUrl: z.string().url(),
  brandId: z.string().optional().nullable(),
});

export async function createReviewIntelSource(
  input: z.infer<typeof createSourceSchema>,
) {
  const session = await requireMarketAnalyst();
  const data = createSourceSchema.parse(input);

  const source = await prisma.reviewIntelSource.create({
    data: {
      productName: data.productName,
      competitorBrand: data.competitorBrand,
      marketplace: data.marketplace,
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

export async function rescrapeReviewIntelSource(sourceId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(sourceId);

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

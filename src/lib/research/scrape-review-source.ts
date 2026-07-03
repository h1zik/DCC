import "server-only";

import { after } from "next/server";

import {
  ResearchScrapeJobStatus,
  ResearchScrapeJobType,
  ReviewIntelSourceStatus,
  ScrapeDataProvenance,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchApifyDataset } from "@/lib/apify/client";
import type { NormalizedReview, ReviewScrapeMeta } from "@/lib/apify/normalize";
import {
  generateDemoReviews,
} from "@/lib/apify/normalize";
import { assertDemoDataAllowed } from "@/lib/demo-data-policy";
import { processReviewScrapeDataset } from "@/lib/review-scrape/process-dataset";
import { toDbProvenance } from "@/lib/research/provenance-db";
import type { ScrapeDataProvider } from "@/lib/research/scrape-data-provider";
import { analyzeReviewSource } from "@/lib/research/review-analyzer";
import { executeReviewScrapeJob } from "@/lib/research/run-review-scrape-job";

/** Reset state & antri scrape review (non-blocking — worker jalan via `after()`). */
export async function enqueueReviewScrape(sourceId: string): Promise<void> {
  const source = await prisma.reviewIntelSource.findUnique({
    where: { id: sourceId },
  });
  if (!source) throw new Error("Sumber review tidak ditemukan.");

  await prisma.reviewRaw.deleteMany({ where: { sourceId } });
  await prisma.reviewIntelSummary.deleteMany({ where: { sourceId } });

  await prisma.reviewIntelSource.update({
    where: { id: sourceId },
    data: {
      status: ReviewIntelSourceStatus.SCRAPING,
      errorMessage: null,
      reviewCount: 0,
      totalReviewsReported: null,
      reviewsAccessible: null,
      reviewsComplete: null,
      lastAnalyzedAt: null,
    },
  });

  const job = await prisma.researchScrapeJob.create({
    data: {
      type: ResearchScrapeJobType.REVIEW_SCRAPE,
      entityId: sourceId,
      status: ResearchScrapeJobStatus.PENDING,
      startedAt: new Date(),
    },
  });

  after(async () => {
    try {
      await executeReviewScrapeJob(job.id);
    } catch (err) {
      console.error("[enqueueReviewScrape]", job.id, err);
    }
  });
}

export async function runDemoReviewScrape(sourceId: string): Promise<void> {
  // Fail-loud di produksi: jangan pernah menulis review fabrikasi tanpa izin eksplisit.
  assertDemoDataAllowed("Scraper review (VPS/Apify)");

  const reviews = generateDemoReviews(48);
  await prisma.reviewRaw.createMany({
    data: reviews.map((r) => ({
      sourceId,
      externalId: r.externalId,
      author: r.author,
      rating: r.rating,
      text: r.text,
      reviewDate: r.reviewDate,
    })),
    skipDuplicates: true,
  });

  await prisma.reviewIntelSource.update({
    where: { id: sourceId },
    data: {
      reviewCount: reviews.length,
      dataProvenance: ScrapeDataProvenance.DEMO,
    },
  });

  await runReviewAnalysis(sourceId);
}

async function runReviewAnalysis(sourceId: string): Promise<void> {
  try {
    await analyzeReviewSource(sourceId);
  } catch (err) {
    console.error("[scrape-review-source] analisis gagal", sourceId, err);
    await prisma.reviewIntelSource.update({
      where: { id: sourceId },
      data: {
        status: ReviewIntelSourceStatus.FAILED,
        errorMessage:
          err instanceof Error ? err.message : "Analisis review gagal.",
      },
    });
    throw err instanceof Error ? err : new Error("Analisis review gagal.");
  }
}

export async function completeReviewScrapeFromNormalized(
  sourceId: string,
  normalized: NormalizedReview[],
  meta: ReviewScrapeMeta,
  provider?: ScrapeDataProvider,
): Promise<void> {
  if (normalized.length === 0) {
    await prisma.reviewIntelSource.update({
      where: { id: sourceId },
      data: {
        status: ReviewIntelSourceStatus.FAILED,
        errorMessage: "Tidak ada review ditemukan dari scraper.",
      },
    });
    throw new Error("Tidak ada review ditemukan dari scraper.");
  }

  await prisma.reviewRaw.createMany({
    data: normalized.map((r) => ({
      sourceId,
      externalId: r.externalId,
      author: r.author,
      rating: r.rating,
      text: r.text,
      reviewDate: r.reviewDate,
    })),
    skipDuplicates: true,
  });

  await prisma.reviewIntelSource.update({
    where: { id: sourceId },
    data: {
      reviewCount: normalized.length,
      totalReviewsReported: meta.totalReviewsReported,
      reviewsAccessible: meta.reviewsAccessible,
      reviewsComplete: meta.reviewsComplete,
      ...(provider
        ? { dataProvenance: toDbProvenance(provider) ?? undefined }
        : {}),
    },
  });

  await runReviewAnalysis(sourceId);
}

export async function completeReviewScrapeFromDataset(
  sourceId: string,
  items: Record<string, unknown>[],
  platformKey?: string,
): Promise<void> {
  let resolvedPlatformKey = platformKey;
  if (!resolvedPlatformKey) {
    const source = await prisma.reviewIntelSource.findUnique({
      where: { id: sourceId },
      select: { platformKey: true },
    });
    resolvedPlatformKey = source?.platformKey ?? "shopee";
  }

  const { normalized, meta, errorMessage } = processReviewScrapeDataset(
    resolvedPlatformKey,
    items,
  );

  if (errorMessage) {
    await prisma.reviewIntelSource.update({
      where: { id: sourceId },
      data: {
        status: ReviewIntelSourceStatus.FAILED,
        errorMessage,
      },
    });
    throw new Error(errorMessage);
  }

  await completeReviewScrapeFromNormalized(sourceId, normalized, meta, "apify");
}

export async function completeReviewScrapeFromImportedReviews(
  sourceId: string,
  normalized: NormalizedReview[],
): Promise<void> {
  await completeReviewScrapeFromNormalized(
    sourceId,
    normalized,
    {
      totalReviewsReported: normalized.length,
      reviewsAccessible: normalized.length,
      reviewsComplete: true,
    },
    "csv",
  );
}

async function markReviewScrapeJobFailed(
  jobId: string,
  entityId: string,
  message: string,
): Promise<void> {
  await prisma.researchScrapeJob.update({
    where: { id: jobId },
    data: {
      status: ResearchScrapeJobStatus.FAILED,
      error: message,
      completedAt: new Date(),
    },
  });
  await prisma.reviewIntelSource.update({
    where: { id: entityId },
    data: {
      status: ReviewIntelSourceStatus.FAILED,
      errorMessage: message,
    },
  });
}

export async function pollReviewScrapeJob(jobId: string): Promise<void> {
  const job = await prisma.researchScrapeJob.findUnique({ where: { id: jobId } });
  if (!job?.apifyRunId || job.type !== ResearchScrapeJobType.REVIEW_SCRAPE) return;
  if (
    job.status === ResearchScrapeJobStatus.COMPLETED ||
    job.status === ResearchScrapeJobStatus.FAILED
  ) {
    return;
  }

  const { getApifyRunStatus } = await import("@/lib/apify/client");
  const { status, datasetId } = await getApifyRunStatus(job.apifyRunId);

  if (status === "RUNNING" || status === "READY") return;

  if (status === "SUCCEEDED") {
    try {
      const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
      await completeReviewScrapeFromDataset(job.entityId, items);
      await prisma.researchScrapeJob.update({
        where: { id: jobId },
        data: {
          status: ResearchScrapeJobStatus.COMPLETED,
          completedAt: new Date(),
          error: null,
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Scrape review gagal.";
      await markReviewScrapeJobFailed(jobId, job.entityId, message);
    }
    return;
  }

  await markReviewScrapeJobFailed(
    jobId,
    job.entityId,
    `Scrape gagal: ${status}`,
  );
}

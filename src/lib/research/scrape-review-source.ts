import "server-only";

import {
  ResearchScrapeJobStatus,
  ResearchScrapeJobType,
  ReviewIntelSourceStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildReviewActorInput,
  getReviewActorId,
  actorEnvHint,
} from "@/lib/apify/actors";
import {
  fetchApifyDataset,
  isApifyConfigured,
  startApifyActor,
} from "@/lib/apify/client";
import {
  generateDemoReviews,
  normalizeReviewItems,
} from "@/lib/apify/normalize";
import { analyzeReviewSource } from "@/lib/research/review-analyzer";
import { runApifyJobToCompletion } from "@/lib/research/run-apify-job";

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
      lastAnalyzedAt: null,
    },
  });

  if (!isApifyConfigured()) {
    await runDemoReviewScrape(sourceId);
    return;
  }

  const actorId = getReviewActorId(source.marketplace);
  if (!actorId) {
    await prisma.reviewIntelSource.update({
      where: { id: sourceId },
      data: {
        status: ReviewIntelSourceStatus.FAILED,
        errorMessage: actorEnvHint(
          ResearchScrapeJobType.REVIEW_SCRAPE,
          source.marketplace,
        ),
      },
    });
    return;
  }

  const { runId } = await startApifyActor(
    actorId,
    buildReviewActorInput(source.marketplace, source.productUrl),
  );

  const job = await prisma.researchScrapeJob.create({
    data: {
      type: ResearchScrapeJobType.REVIEW_SCRAPE,
      entityId: sourceId,
      apifyRunId: runId,
      status: ResearchScrapeJobStatus.RUNNING,
      startedAt: new Date(),
    },
  });

  await runApifyJobToCompletion(job.id, ResearchScrapeJobType.REVIEW_SCRAPE);
}

async function runDemoReviewScrape(sourceId: string): Promise<void> {
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
    data: { reviewCount: reviews.length },
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
  }
}

export async function completeReviewScrapeFromDataset(
  sourceId: string,
  items: Record<string, unknown>[],
): Promise<void> {
  const hasMock = items.some((x) => x._mock === true);
  const normalized = normalizeReviewItems(items);
  if (normalized.length === 0) {
    await prisma.reviewIntelSource.update({
      where: { id: sourceId },
      data: {
        status: ReviewIntelSourceStatus.FAILED,
        errorMessage: hasMock
          ? "Apify mengembalikan data MOCK — upgrade ke plan berbayar Apify untuk data Shopee live."
          : "Tidak ada review ditemukan dari scraper. Pastikan includeReviews aktif dan URL produk Shopee valid.",
      },
    });
    return;
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
    data: { reviewCount: normalized.length },
  });

  await runReviewAnalysis(sourceId);
}

export async function pollReviewScrapeJob(jobId: string): Promise<void> {
  const job = await prisma.researchScrapeJob.findUnique({ where: { id: jobId } });
  if (!job?.apifyRunId || job.type !== ResearchScrapeJobType.REVIEW_SCRAPE) return;

  const { getApifyRunStatus } = await import("@/lib/apify/client");
  const { status, datasetId } = await getApifyRunStatus(job.apifyRunId);

  if (status === "RUNNING" || status === "READY") return;

  if (status === "SUCCEEDED") {
    const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
    await completeReviewScrapeFromDataset(job.entityId, items);
    await prisma.researchScrapeJob.update({
      where: { id: jobId },
      data: {
        status: ResearchScrapeJobStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    return;
  }

  await prisma.researchScrapeJob.update({
    where: { id: jobId },
    data: {
      status: ResearchScrapeJobStatus.FAILED,
      error: `Apify run status: ${status}`,
      completedAt: new Date(),
    },
  });
  await prisma.reviewIntelSource.update({
    where: { id: job.entityId },
    data: {
      status: ReviewIntelSourceStatus.FAILED,
      errorMessage: `Scrape gagal: ${status}`,
    },
  });
}

import "server-only";

import {
  ResearchScrapeJobStatus,
  ResearchScrapeJobType,
  ReviewIntelSourceStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildReviewActorInputByPlatformKey,
  getReviewActorIdByPlatformKey,
  reviewActorEnvHintByPlatformKey,
} from "@/lib/apify/actors";
import { getApifyRunStatus, isApifyConfigured, startApifyActor } from "@/lib/apify/client";
import {
  completeReviewScrapeFromNormalized,
  pollReviewScrapeJob,
  runDemoReviewScrape,
} from "@/lib/research/scrape-review-source";
import {
  scrapeReviewsNative,
  usesNativeReviewScrape,
} from "@/lib/review-scrape/native-scrape";

/** Job yang sedang jalan di proses Node ini — cegah scrape ganda dari polling. */
const activeReviewScrapeJobIds = new Set<string>();

async function markJobCompleted(jobId: string): Promise<void> {
  await prisma.researchScrapeJob.update({
    where: { id: jobId },
    data: {
      status: ResearchScrapeJobStatus.COMPLETED,
      completedAt: new Date(),
      error: null,
    },
  });
}

async function markJobFailed(jobId: string, message: string): Promise<void> {
  await prisma.researchScrapeJob.update({
    where: { id: jobId },
    data: {
      status: ResearchScrapeJobStatus.FAILED,
      error: message,
      completedAt: new Date(),
    },
  });
}

/**
 * Job yang salah ditandai GAGAL (timeout lokal) padahal run Apify sudah SUCCEEDED.
 * Pulihkan dataset yang belum diproses.
 */
export async function recoverMisclassifiedReviewScrapeJobs(
  limit = 5,
): Promise<number> {
  const jobs = await prisma.researchScrapeJob.findMany({
    where: {
      type: ResearchScrapeJobType.REVIEW_SCRAPE,
      status: ResearchScrapeJobStatus.FAILED,
      apifyRunId: { not: null },
      error: { contains: "batas waktu" },
    },
    orderBy: { completedAt: "desc" },
    take: limit,
  });

  let recovered = 0;
  for (const job of jobs) {
    if (activeReviewScrapeJobIds.has(job.id)) continue;
    try {
      const { status } = await getApifyRunStatus(job.apifyRunId!);
      if (status !== "SUCCEEDED") continue;

      await prisma.researchScrapeJob.update({
        where: { id: job.id },
        data: {
          status: ResearchScrapeJobStatus.RUNNING,
          error: null,
          completedAt: null,
        },
      });
      await prisma.reviewIntelSource.update({
        where: { id: job.entityId },
        data: {
          status: ReviewIntelSourceStatus.SCRAPING,
          errorMessage: null,
        },
      });

      activeReviewScrapeJobIds.add(job.id);
      try {
        await pollReviewScrapeJob(job.id);
        recovered += 1;
      } finally {
        activeReviewScrapeJobIds.delete(job.id);
      }
    } catch (err) {
      console.error("[recoverMisclassifiedReviewScrapeJobs]", job.id, err);
    }
  }
  return recovered;
}

/** Worker scrape review — start Apify lalu poll ringan (tanpa blocking 10 menit). */
export async function executeReviewScrapeJob(jobId: string): Promise<void> {
  if (activeReviewScrapeJobIds.has(jobId)) {
    return;
  }

  const job = await prisma.researchScrapeJob.findUnique({ where: { id: jobId } });
  if (!job || job.type !== ResearchScrapeJobType.REVIEW_SCRAPE) return;
  if (
    job.status === ResearchScrapeJobStatus.COMPLETED ||
    job.status === ResearchScrapeJobStatus.FAILED
  ) {
    return;
  }

  activeReviewScrapeJobIds.add(jobId);
  try {
    await prisma.researchScrapeJob.update({
      where: { id: jobId },
      data: {
        status: ResearchScrapeJobStatus.RUNNING,
        startedAt: job.startedAt ?? new Date(),
      },
    });

    const source = await prisma.reviewIntelSource.findUnique({
      where: { id: job.entityId },
    });
    if (!source) {
      await markJobFailed(jobId, "Sumber review tidak ditemukan.");
      return;
    }

    if (job.apifyRunId) {
      await pollReviewScrapeJob(jobId);
      return;
    }

    const platformKey = source.platformKey ?? "shopee";

    if (platformKey === "csv") {
      await markJobFailed(jobId, "Sumber CSV tidak memerlukan scrape Apify.");
      return;
    }

    if (usesNativeReviewScrape(platformKey)) {
      const { reviews, meta } = await scrapeReviewsNative(
        platformKey,
        source.productUrl,
      );
      await completeReviewScrapeFromNormalized(source.id, reviews, meta);
      await markJobCompleted(jobId);
      return;
    }

    if (!isApifyConfigured()) {
      await runDemoReviewScrape(source.id);
      await markJobCompleted(jobId);
      return;
    }

    const actorId = getReviewActorIdByPlatformKey(platformKey);
    if (!actorId) {
      throw new Error(reviewActorEnvHintByPlatformKey(platformKey));
    }

    const { runId } = await startApifyActor(
      actorId,
      buildReviewActorInputByPlatformKey(platformKey, source.productUrl),
    );

    await prisma.researchScrapeJob.update({
      where: { id: jobId },
      data: { apifyRunId: runId },
    });

    // Satu poll awal; sisanya lewat UI polling / page refresh.
    await pollReviewScrapeJob(jobId);
  } catch (err) {
    const latest = await prisma.researchScrapeJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    if (latest?.status === ResearchScrapeJobStatus.RUNNING) {
      await markJobFailed(
        jobId,
        err instanceof Error ? err.message : "Scrape review gagal.",
      );
      await prisma.reviewIntelSource.update({
        where: { id: job.entityId },
        data: {
          status: ReviewIntelSourceStatus.FAILED,
          errorMessage:
            err instanceof Error ? err.message : "Scrape review gagal.",
        },
      });
    }
  } finally {
    activeReviewScrapeJobIds.delete(jobId);
  }
}

/** Poll Apify sekali per job RUNNING — aman dipanggil dari UI polling. */
export async function pollReviewScrapeJobsLight(): Promise<number> {
  const jobs = await prisma.researchScrapeJob.findMany({
    where: {
      type: ResearchScrapeJobType.REVIEW_SCRAPE,
      status: ResearchScrapeJobStatus.RUNNING,
      apifyRunId: { not: null },
    },
    take: 8,
    orderBy: { createdAt: "asc" },
  });

  let polled = 0;
  for (const job of jobs) {
    if (activeReviewScrapeJobIds.has(job.id)) continue;
    activeReviewScrapeJobIds.add(job.id);
    try {
      await pollReviewScrapeJob(job.id);
      polled += 1;
    } catch (err) {
      console.error("[pollReviewScrapeJobsLight]", job.id, err);
    } finally {
      activeReviewScrapeJobIds.delete(job.id);
    }
  }
  return polled;
}

/** Lanjutkan job PENDING atau poll job RUNNING yang belum diproses. */
export async function resumeStuckReviewScrapeJobs(limit = 5): Promise<number> {
  await recoverMisclassifiedReviewScrapeJobs(limit);

  const polled = await pollReviewScrapeJobsLight();
  if (polled > 0) return polled;

  const jobs = await prisma.researchScrapeJob.findMany({
    where: {
      type: ResearchScrapeJobType.REVIEW_SCRAPE,
      status: ResearchScrapeJobStatus.PENDING,
      apifyRunId: null,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let resumed = 0;
  for (const job of jobs) {
    if (activeReviewScrapeJobIds.has(job.id)) continue;
    try {
      await executeReviewScrapeJob(job.id);
      resumed += 1;
    } catch (err) {
      console.error("[resumeStuckReviewScrapeJobs]", job.id, err);
    }
  }
  return resumed;
}


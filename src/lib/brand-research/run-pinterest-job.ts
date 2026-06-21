import "server-only";

import {
  BrandVisualCollectionStatus,
  ResearchScrapeJobStatus,
  ResearchScrapeJobType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executeBrandPinterestScrape } from "@/lib/brand-research/scrape-pinterest";

/** Job Pinterest yang sedang jalan di proses Node ini — cegah scrape ganda dari polling/resume. */
const activePinterestScrapeJobIds = new Set<string>();
const activePinterestCollectionIds = new Set<string>();

/** Job RUNNING dianggap macet setelah interval ini (mis. restart server). */
const STALE_PINTEREST_JOB_MS = 15 * 60 * 1000;

async function tryClaimPinterestJob(jobId: string): Promise<boolean> {
  const claimedPending = await prisma.brandResearchScrapeJob.updateMany({
    where: { id: jobId, status: ResearchScrapeJobStatus.PENDING },
    data: { status: ResearchScrapeJobStatus.RUNNING, startedAt: new Date() },
  });
  if (claimedPending.count > 0) return true;

  const staleBefore = new Date(Date.now() - STALE_PINTEREST_JOB_MS);
  const reclaimedStale = await prisma.brandResearchScrapeJob.updateMany({
    where: {
      id: jobId,
      type: ResearchScrapeJobType.PINTEREST_SCRAPE,
      status: ResearchScrapeJobStatus.RUNNING,
      startedAt: { lt: staleBefore },
    },
    data: { startedAt: new Date(), error: null },
  });
  return reclaimedStale.count > 0;
}

/**
 * Worker tunggal per job — VPS dulu, Apify fallback per keyword.
 * Aman dipanggil dari after() maupun resume; duplikat diabaikan.
 */
export async function executeBrandPinterestScrapeJob(jobId: string): Promise<void> {
  if (activePinterestScrapeJobIds.has(jobId)) return;

  const job = await prisma.brandResearchScrapeJob.findUnique({ where: { id: jobId } });
  if (!job || job.type !== ResearchScrapeJobType.PINTEREST_SCRAPE) return;
  if (
    job.status === ResearchScrapeJobStatus.COMPLETED ||
    job.status === ResearchScrapeJobStatus.FAILED
  ) {
    return;
  }

  if (activePinterestCollectionIds.has(job.entityId)) return;

  const claimed = await tryClaimPinterestJob(jobId);
  if (!claimed) return;

  activePinterestScrapeJobIds.add(jobId);
  activePinterestCollectionIds.add(job.entityId);

  try {
    const count = await executeBrandPinterestScrape(job.entityId);
    if (count === 0) {
      throw new Error("Tidak ada pin yang berhasil diimpor dari Pinterest.");
    }

    await prisma.brandResearchScrapeJob.update({
      where: { id: jobId },
      data: {
        status: ResearchScrapeJobStatus.COMPLETED,
        completedAt: new Date(),
        error: null,
        percent: 100,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pinterest scrape gagal.";
    await prisma.brandResearchScrapeJob.update({
      where: { id: jobId },
      data: {
        status: ResearchScrapeJobStatus.FAILED,
        error: message,
        completedAt: new Date(),
      },
    });
    await prisma.brandVisualCollection.update({
      where: { id: job.entityId },
      data: {
        status: BrandVisualCollectionStatus.FAILED,
        errorMessage: message,
      },
    });
    throw err;
  } finally {
    activePinterestScrapeJobIds.delete(jobId);
    activePinterestCollectionIds.delete(job.entityId);
  }
}

/** @deprecated Gunakan executeBrandPinterestScrapeJob — tetap diekspor untuk kompatibilitas. */
export async function runBrandPinterestJobToCompletion(jobId: string): Promise<void> {
  await executeBrandPinterestScrapeJob(jobId);
}

/** Lanjutkan job PENDING yang belum pernah di-worker (mis. setelah restart server). */
export async function resumeStuckBrandPinterestJobs(limit = 3): Promise<void> {
  const jobs = await prisma.brandResearchScrapeJob.findMany({
    where: {
      status: ResearchScrapeJobStatus.PENDING,
      type: ResearchScrapeJobType.PINTEREST_SCRAPE,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const job of jobs) {
    if (activePinterestScrapeJobIds.has(job.id)) continue;
    try {
      await executeBrandPinterestScrapeJob(job.id);
    } catch (err) {
      console.error("[resumeStuckBrandPinterestJobs]", job.id, err);
    }
  }

  const staleBefore = new Date(Date.now() - STALE_PINTEREST_JOB_MS);
  const staleJobs = await prisma.brandResearchScrapeJob.findMany({
    where: {
      status: ResearchScrapeJobStatus.RUNNING,
      type: ResearchScrapeJobType.PINTEREST_SCRAPE,
      startedAt: { lt: staleBefore },
    },
    orderBy: { startedAt: "asc" },
    take: limit,
  });

  for (const job of staleJobs) {
    if (activePinterestScrapeJobIds.has(job.id)) continue;
    try {
      await executeBrandPinterestScrapeJob(job.id);
    } catch (err) {
      console.error("[resumeStuckBrandPinterestJobs/stale]", job.id, err);
    }
  }
}

import "server-only";

import {
  ProductDiscoveryStatus,
  ResearchScrapeJobStatus,
  ResearchScrapeJobType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getApifyRunStatus } from "@/lib/apify/client";
import {
  isApifyReadyForDiscovery,
  markProductDiscoveryFailed,
  pollProductDiscoveryJob,
  runDemoProductDiscovery,
  startNextMarketplaceRun,
} from "@/lib/research/scrape-product-discovery";

const activeJobIds = new Set<string>();

/** Job yang salah FAILED padahal run Apify sudah SUCCEEDED. */
export async function recoverMisclassifiedProductDiscoveryJobs(
  limit = 5,
): Promise<number> {
  const jobs = await prisma.researchScrapeJob.findMany({
    where: {
      type: ResearchScrapeJobType.PRODUCT_DISCOVERY,
      status: ResearchScrapeJobStatus.FAILED,
      apifyRunId: { not: null },
    },
    orderBy: { completedAt: "desc" },
    take: limit,
  });

  let recovered = 0;
  for (const job of jobs) {
    if (activeJobIds.has(job.id)) continue;
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
      await prisma.productDiscoveryQuery.update({
        where: { id: job.entityId },
        data: { status: ProductDiscoveryStatus.SCRAPING, errorMessage: null },
      });

      activeJobIds.add(job.id);
      try {
        await pollProductDiscoveryJob(job.id);
        recovered += 1;
      } finally {
        activeJobIds.delete(job.id);
      }
    } catch (err) {
      console.error("[recoverMisclassifiedProductDiscoveryJobs]", job.id, err);
    }
  }
  return recovered;
}

export async function executeProductDiscoveryJob(jobId: string): Promise<void> {
  if (activeJobIds.has(jobId)) return;

  const job = await prisma.researchScrapeJob.findUnique({ where: { id: jobId } });
  if (!job || job.type !== ResearchScrapeJobType.PRODUCT_DISCOVERY) return;
  if (
    job.status === ResearchScrapeJobStatus.COMPLETED ||
    job.status === ResearchScrapeJobStatus.FAILED
  ) {
    return;
  }

  activeJobIds.add(jobId);
  try {
    const query = await prisma.productDiscoveryQuery.findUnique({
      where: { id: job.entityId },
    });
    if (!query) {
      await markProductDiscoveryFailed(
        job.entityId,
        jobId,
        "Query product discovery tidak ditemukan.",
      );
      return;
    }

    if (job.apifyRunId) {
      await pollProductDiscoveryJob(jobId);
      return;
    }

    if (!isApifyReadyForDiscovery()) {
      await runDemoProductDiscovery(query.id);
      await prisma.researchScrapeJob.update({
        where: { id: jobId },
        data: {
          status: ResearchScrapeJobStatus.COMPLETED,
          completedAt: new Date(),
          error: null,
        },
      });
      return;
    }

    await startNextMarketplaceRun(jobId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Product discovery gagal.";
    await markProductDiscoveryFailed(job.entityId, jobId, message);
  } finally {
    activeJobIds.delete(jobId);
  }
}

/** Poll Apify sekali per job RUNNING — aman dipanggil dari UI polling. */
export async function pollProductDiscoveryJobsLight(): Promise<number> {
  const jobs = await prisma.researchScrapeJob.findMany({
    where: {
      type: ResearchScrapeJobType.PRODUCT_DISCOVERY,
      status: ResearchScrapeJobStatus.RUNNING,
      apifyRunId: { not: null },
    },
    take: 8,
    orderBy: { createdAt: "asc" },
  });

  let polled = 0;
  for (const job of jobs) {
    if (activeJobIds.has(job.id)) continue;
    activeJobIds.add(job.id);
    try {
      await pollProductDiscoveryJob(job.id);
      polled += 1;
    } catch (err) {
      console.error("[pollProductDiscoveryJobsLight]", job.id, err);
    } finally {
      activeJobIds.delete(job.id);
    }
  }
  return polled;
}

export async function resumeStuckProductDiscoveryJobs(
  limit = 3,
): Promise<number> {
  await recoverMisclassifiedProductDiscoveryJobs(limit);

  const polled = await pollProductDiscoveryJobsLight();
  if (polled > 0) return polled;

  const jobs = await prisma.researchScrapeJob.findMany({
    where: {
      type: ResearchScrapeJobType.PRODUCT_DISCOVERY,
      status: ResearchScrapeJobStatus.PENDING,
      apifyRunId: null,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let resumed = 0;
  for (const job of jobs) {
    if (activeJobIds.has(job.id)) continue;
    try {
      await executeProductDiscoveryJob(job.id);
      resumed += 1;
    } catch (err) {
      console.error("[resumeStuckProductDiscoveryJobs]", job.id, err);
    }
  }
  return resumed;
}

export async function pollProductDiscoveryInProgress(): Promise<number> {
  const polled = await pollProductDiscoveryJobsLight();
  if (polled > 0) return polled;

  const scraping = await prisma.productDiscoveryQuery.count({
    where: { status: ProductDiscoveryStatus.SCRAPING },
  });
  if (scraping > 0) {
    return resumeStuckProductDiscoveryJobs(2);
  }
  return 0;
}

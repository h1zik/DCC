import "server-only";

import {
  BrandVisualCollectionStatus,
  ResearchScrapeJobStatus,
  ResearchScrapeJobType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executeBrandPinterestScrape } from "@/lib/brand-research/scrape-pinterest";

export async function runBrandPinterestJobToCompletion(jobId: string): Promise<void> {
  const job = await prisma.brandResearchScrapeJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== ResearchScrapeJobStatus.RUNNING) return;
  if (job.type !== ResearchScrapeJobType.PINTEREST_SCRAPE) return;

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
  }
}

export async function resumeStuckBrandPinterestJobs(limit = 3): Promise<void> {
  const jobs = await prisma.brandResearchScrapeJob.findMany({
    where: {
      status: ResearchScrapeJobStatus.RUNNING,
      type: ResearchScrapeJobType.PINTEREST_SCRAPE,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const job of jobs) {
    try {
      await runBrandPinterestJobToCompletion(job.id);
    } catch (err) {
      console.error("[resumeStuckBrandPinterestJobs]", job.id, err);
    }
  }
}

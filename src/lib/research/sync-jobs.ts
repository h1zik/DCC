import "server-only";

import { ResearchScrapeJobStatus, ResearchScrapeJobType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runApifyJobToCompletion } from "@/lib/research/run-apify-job";
import {
  pollReviewScrapeJobsLight,
  resumeStuckReviewScrapeJobs,
} from "@/lib/research/run-review-scrape-job";
import { resumeStuckProductDiscoveryJobs, pollProductDiscoveryJobsLight } from "@/lib/research/run-product-discovery-job";

export async function pollRunningResearchJobs(): Promise<void> {
  await pollReviewScrapeJobsLight();
  await pollProductDiscoveryJobsLight();

  const competitorJobs = await prisma.researchScrapeJob.findMany({
    where: {
      status: ResearchScrapeJobStatus.RUNNING,
      type: ResearchScrapeJobType.COMPETITOR_SNAPSHOT,
    },
    take: 10,
    orderBy: { createdAt: "asc" },
  });

  for (const job of competitorJobs) {
    try {
      await runApifyJobToCompletion(job.id, ResearchScrapeJobType.COMPETITOR_SNAPSHOT);
    } catch (err) {
      console.error("[sync-jobs] competitor poll gagal", job.id, err);
    }
  }

  await resumeStuckReviewScrapeJobs(3);
  await resumeStuckProductDiscoveryJobs(2);
}

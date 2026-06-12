import "server-only";

import { ResearchScrapeJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runApifyJobToCompletion } from "@/lib/research/run-apify-job";

export async function pollRunningResearchJobs(): Promise<void> {
  const jobs = await prisma.researchScrapeJob.findMany({
    where: { status: ResearchScrapeJobStatus.RUNNING },
    take: 20,
    orderBy: { createdAt: "asc" },
  });

  for (const job of jobs) {
    try {
      await runApifyJobToCompletion(job.id, job.type);
    } catch (err) {
      console.error("[sync-jobs] poll gagal", job.id, err);
    }
  }
}

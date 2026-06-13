import "server-only";

import { ResearchScrapeJobStatus, ResearchScrapeJobType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fetchApifyDataset,
  waitForApifyRun,
} from "@/lib/apify/client";
import { completeReviewScrapeFromDataset } from "@/lib/research/scrape-review-source";
import { ingestCompetitorProducts } from "@/lib/research/scrape-competitor";
import { normalizeShopProducts } from "@/lib/apify/normalize";

/** Poll Apify sampai selesai lalu proses dataset ke DB. */
export async function runApifyJobToCompletion(
  jobId: string,
  type: "REVIEW_SCRAPE" | "COMPETITOR_SNAPSHOT",
): Promise<void> {
  const job = await prisma.researchScrapeJob.findUnique({ where: { id: jobId } });
  if (!job?.apifyRunId || job.status !== ResearchScrapeJobStatus.RUNNING) return;

  try {
    const { status, datasetId } = await waitForApifyRun(job.apifyRunId);

    if (status === "SUCCEEDED") {
      const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);

      if (type === "REVIEW_SCRAPE") {
        await completeReviewScrapeFromDataset(job.entityId, items);
      } else {
        const products = normalizeShopProducts(items);
        if (products.length === 0) {
          const hasMock = items.some((x) => x._mock === true);
          const notice = items.find((x) => typeof x._notice === "string")?._notice;
          throw new Error(
            hasMock
              ? "Apify mengembalikan data MOCK — upgrade plan Apify untuk data live, atau periksa URL toko Shopee (bukan URL produk)."
              : (typeof notice === "string" ? notice : null) ??
                "Tidak ada produk dari scraper. Pastikan URL toko Shopee valid.",
          );
        }
        await ingestCompetitorProducts(job.entityId, products);
      }

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

    throw new Error(`Apify run status: ${status}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scrape gagal.";
    await prisma.researchScrapeJob.update({
      where: { id: jobId },
      data: {
        status: ResearchScrapeJobStatus.FAILED,
        error: message,
        completedAt: new Date(),
      },
    });

    if (type === "REVIEW_SCRAPE") {
      await prisma.reviewIntelSource.update({
        where: { id: job.entityId },
        data: { status: "FAILED", errorMessage: message },
      });
    }
    throw err;
  }
}

/** Selesaikan job RUNNING yang tertinggal (mis. setelah restart server). */
export async function resumeStuckResearchJobs(limit = 5): Promise<void> {
  const { resumeStuckReviewScrapeJobs } = await import(
    "@/lib/research/run-review-scrape-job"
  );
  const { resumeStuckProductDiscoveryJobs } = await import(
    "@/lib/research/run-product-discovery-job"
  );
  await resumeStuckReviewScrapeJobs(Math.min(limit, 5));
  await resumeStuckProductDiscoveryJobs(Math.min(limit, 3));

  const jobs = await prisma.researchScrapeJob.findMany({
    where: {
      status: ResearchScrapeJobStatus.RUNNING,
      type: ResearchScrapeJobType.COMPETITOR_SNAPSHOT,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const job of jobs) {
    try {
      await runApifyJobToCompletion(job.id, ResearchScrapeJobType.COMPETITOR_SNAPSHOT);
    } catch (err) {
      console.error("[resumeStuckResearchJobs]", job.id, err);
    }
  }
}

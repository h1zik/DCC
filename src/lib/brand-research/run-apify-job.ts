import "server-only";

import { ResearchScrapeJobStatus, ResearchScrapeJobType, ResearchMarketplace } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fetchApifyDataset,
  waitForApifyRun,
} from "@/lib/apify/client";
import { completeBrandReviewScrapeFromDataset } from "@/lib/brand-research/scrape-review-source";
import { ingestBrandCompetitorProducts } from "@/lib/brand-research/scrape-competitor";
import { normalizeShopProducts } from "@/lib/apify/normalize";
import { filterShopProductsByShopUrl } from "@/lib/apify/tiktok-kulqiz";

/** Poll Apify sampai selesai lalu proses dataset ke DB. */
export async function runBrandApifyJobToCompletion(
  jobId: string,
  type: "REVIEW_SCRAPE" | "COMPETITOR_SNAPSHOT",
): Promise<void> {
  const job = await prisma.brandResearchScrapeJob.findUnique({ where: { id: jobId } });
  if (!job?.apifyRunId || job.status !== ResearchScrapeJobStatus.RUNNING) return;

  try {
    const { status, datasetId } = await waitForApifyRun(job.apifyRunId);

    if (status === "SUCCEEDED") {
      const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);

      if (type === "REVIEW_SCRAPE") {
        await completeBrandReviewScrapeFromDataset(job.entityId, items);
      } else {
        const competitor = await prisma.brandCompetitor.findUnique({
          where: { id: job.entityId },
        });
        let products = normalizeShopProducts(items);
        if (competitor?.marketplace === ResearchMarketplace.TIKTOK_SHOP) {
          products = filterShopProductsByShopUrl(products, competitor.shopUrl);
        }
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
        await ingestBrandCompetitorProducts(job.entityId, products);
      }

      await prisma.brandResearchScrapeJob.update({
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
    await prisma.brandResearchScrapeJob.update({
      where: { id: jobId },
      data: {
        status: ResearchScrapeJobStatus.FAILED,
        error: message,
        completedAt: new Date(),
      },
    });

    if (type === "REVIEW_SCRAPE") {
      await prisma.brandReviewSource.update({
        where: { id: job.entityId },
        data: { status: "FAILED", errorMessage: message },
      });
    }
    throw err;
  }
}

/** Selesaikan job RUNNING yang tertinggal (mis. setelah restart server). */
export async function resumeStuckBrandJobs(limit = 5): Promise<void> {
  const { resumeStuckBrandReviewScrapeJobs } = await import(
    "@/lib/brand-research/run-review-scrape-job"
  );
  await resumeStuckBrandReviewScrapeJobs(Math.min(limit, 5));

  const jobs = await prisma.brandResearchScrapeJob.findMany({
    where: {
      status: ResearchScrapeJobStatus.RUNNING,
      type: ResearchScrapeJobType.COMPETITOR_SNAPSHOT,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const job of jobs) {
    try {
      await runBrandApifyJobToCompletion(job.id, ResearchScrapeJobType.COMPETITOR_SNAPSHOT);
    } catch (err) {
      console.error("[resumeStuckBrandJobs]", job.id, err);
    }
  }
}

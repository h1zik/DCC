import "server-only";

import {
  ResearchScrapeJobStatus,
  ResearchScrapeJobType,
  ResearchMarketplace,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildShopActorInput,
  getShopActorId,
  actorEnvHint,
} from "@/lib/apify/actors";
import {
  fetchApifyDataset,
  isApifyConfigured,
  startApifyActor,
} from "@/lib/apify/client";
import {
  generateDemoShopProducts,
  normalizeShopProducts,
  type NormalizedShopProduct,
} from "@/lib/apify/normalize";
import { filterShopProductsByShopUrl } from "@/lib/apify/tiktok-kulqiz";
import { applyBrandCompetitorSnapshot } from "@/lib/brand-research/competitor-diff";
import { runBrandApifyJobToCompletion } from "@/lib/brand-research/run-apify-job";
import { isScraperApiConfigured } from "@/lib/scraper-api/client";
import { fetchTokopediaShopViaVps } from "@/lib/scraper-api/tokopedia-products";

export async function enqueueBrandCompetitorScrape(
  competitorId: string,
): Promise<void> {
  const competitor = await prisma.brandCompetitor.findUnique({
    where: { id: competitorId },
  });
  if (!competitor) throw new Error("Kompetitor tidak ditemukan.");

  if (
    competitor.marketplace === ResearchMarketplace.TOKOPEDIA &&
    isScraperApiConfigured()
  ) {
    const job = await prisma.brandResearchScrapeJob.create({
      data: {
        type: ResearchScrapeJobType.COMPETITOR_SNAPSHOT,
        entityId: competitorId,
        status: ResearchScrapeJobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      const products = await fetchTokopediaShopViaVps(competitor.shopUrl);
      if (products.length === 0) {
        throw new Error(
          "Tidak ada produk dari toko Tokopedia. Pastikan URL toko valid.",
        );
      }
      await ingestBrandCompetitorProducts(competitorId, products);
      await prisma.brandResearchScrapeJob.update({
        where: { id: job.id },
        data: {
          status: ResearchScrapeJobStatus.COMPLETED,
          completedAt: new Date(),
          error: null,
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Scrape kompetitor gagal.";
      await prisma.brandResearchScrapeJob.update({
        where: { id: job.id },
        data: {
          status: ResearchScrapeJobStatus.FAILED,
          error: message,
          completedAt: new Date(),
        },
      });
      throw err;
    }
    return;
  }

  if (!isApifyConfigured()) {
    await runDemoBrandCompetitorScrape(competitorId);
    return;
  }

  const actorId = getShopActorId(competitor.marketplace);
  if (!actorId) {
    throw new Error(
      actorEnvHint(
        ResearchScrapeJobType.COMPETITOR_SNAPSHOT,
        competitor.marketplace,
      ),
    );
  }

  const { runId } = await startApifyActor(
    actorId,
    buildShopActorInput(competitor.marketplace, competitor.shopUrl),
  );

  const job = await prisma.brandResearchScrapeJob.create({
    data: {
      type: ResearchScrapeJobType.COMPETITOR_SNAPSHOT,
      entityId: competitorId,
      apifyRunId: runId,
      status: ResearchScrapeJobStatus.RUNNING,
      startedAt: new Date(),
    },
  });

  await runBrandApifyJobToCompletion(job.id, ResearchScrapeJobType.COMPETITOR_SNAPSHOT);
}

async function runDemoBrandCompetitorScrape(competitorId: string): Promise<void> {
  const products = generateDemoShopProducts();
  await ingestBrandCompetitorProducts(competitorId, products);
}

export async function ingestBrandCompetitorProducts(
  competitorId: string,
  products: NormalizedShopProduct[],
): Promise<void> {
  const existingSkuCount = await prisma.brandCompetitorSku.count({
    where: { competitorId },
  });
  const isInitialImport = existingSkuCount === 0;

  for (const product of products) {
    const sku = await prisma.brandCompetitorSku.upsert({
      where: {
        competitorId_externalId: {
          competitorId,
          externalId: product.externalId,
        },
      },
      create: {
        competitorId,
        externalId: product.externalId,
        name: product.name,
        productUrl: product.productUrl,
        imageUrl: product.imageUrl,
        currentPrice: product.price,
        rating: product.rating,
        reviewCount: product.reviewCount,
      },
      update: {
        name: product.name,
        productUrl: product.productUrl,
        imageUrl: product.imageUrl ?? undefined,
        currentPrice: product.price,
        rating: product.rating,
        reviewCount: product.reviewCount,
        lastSeenAt: new Date(),
      },
    });

    await applyBrandCompetitorSnapshot(
      competitorId,
      sku.id,
      {
        price: product.price,
        rating: product.rating,
        reviewCount: product.reviewCount,
        hasPromo: product.hasPromo,
        promoText: product.promoText,
        categoryRank: product.categoryRank,
      },
      { suppressNewSkuAlert: isInitialImport },
    );
  }

  try {
    const { analyzeBrandCompetitor } = await import(
      "@/lib/brand-research/competitor-analyzer"
    );
    await analyzeBrandCompetitor(competitorId);
  } catch (err) {
    console.error("[ingestBrandCompetitorProducts] analisis gagal", err);
  }
}

export async function pollBrandCompetitorScrapeJob(jobId: string): Promise<void> {
  const job = await prisma.brandResearchScrapeJob.findUnique({ where: { id: jobId } });
  if (!job?.apifyRunId || job.type !== ResearchScrapeJobType.COMPETITOR_SNAPSHOT) {
    return;
  }

  const { getApifyRunStatus } = await import("@/lib/apify/client");
  const { status, datasetId } = await getApifyRunStatus(job.apifyRunId);

  if (status === "RUNNING" || status === "READY") return;

  if (status === "SUCCEEDED") {
    const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
    const competitor = await prisma.brandCompetitor.findUnique({
      where: { id: job.entityId },
    });
    let products = normalizeShopProducts(items);
    if (competitor?.marketplace === ResearchMarketplace.TIKTOK_SHOP) {
      products = filterShopProductsByShopUrl(products, competitor.shopUrl);
    }
    await ingestBrandCompetitorProducts(job.entityId, products);
    await prisma.brandResearchScrapeJob.update({
      where: { id: jobId },
      data: {
        status: ResearchScrapeJobStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    return;
  }

  await prisma.brandResearchScrapeJob.update({
    where: { id: jobId },
    data: {
      status: ResearchScrapeJobStatus.FAILED,
      error: `Apify run status: ${status}`,
      completedAt: new Date(),
    },
  });
}

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
import { applyCompetitorSnapshot } from "@/lib/research/competitor-diff";
import { runApifyJobToCompletion } from "@/lib/research/run-apify-job";

export async function enqueueCompetitorScrape(
  competitorId: string,
): Promise<void> {
  const competitor = await prisma.researchCompetitor.findUnique({
    where: { id: competitorId },
  });
  if (!competitor) throw new Error("Kompetitor tidak ditemukan.");

  if (!isApifyConfigured()) {
    await runDemoCompetitorScrape(competitorId);
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

  const job = await prisma.researchScrapeJob.create({
    data: {
      type: ResearchScrapeJobType.COMPETITOR_SNAPSHOT,
      entityId: competitorId,
      apifyRunId: runId,
      status: ResearchScrapeJobStatus.RUNNING,
      startedAt: new Date(),
    },
  });

  await runApifyJobToCompletion(job.id, ResearchScrapeJobType.COMPETITOR_SNAPSHOT);
}

async function runDemoCompetitorScrape(competitorId: string): Promise<void> {
  const products = generateDemoShopProducts();
  await ingestCompetitorProducts(competitorId, products);
}

export async function ingestCompetitorProducts(
  competitorId: string,
  products: NormalizedShopProduct[],
): Promise<void> {
  const existingSkuCount = await prisma.competitorSku.count({
    where: { competitorId },
  });
  const isInitialImport = existingSkuCount === 0;

  for (const product of products) {
    const sku = await prisma.competitorSku.upsert({
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

    await applyCompetitorSnapshot(
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
    const { analyzeCompetitor } = await import(
      "@/lib/research/competitor-analyzer"
    );
    await analyzeCompetitor(competitorId);
  } catch (err) {
    console.error("[ingestCompetitorProducts] analisis gagal", err);
  }
}

export async function pollCompetitorScrapeJob(jobId: string): Promise<void> {
  const job = await prisma.researchScrapeJob.findUnique({ where: { id: jobId } });
  if (!job?.apifyRunId || job.type !== ResearchScrapeJobType.COMPETITOR_SNAPSHOT) {
    return;
  }

  const { getApifyRunStatus } = await import("@/lib/apify/client");
  const { status, datasetId } = await getApifyRunStatus(job.apifyRunId);

  if (status === "RUNNING" || status === "READY") return;

  if (status === "SUCCEEDED") {
    const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
    const competitor = await prisma.researchCompetitor.findUnique({
      where: { id: job.entityId },
    });
    let products = normalizeShopProducts(items);
    if (competitor?.marketplace === ResearchMarketplace.TIKTOK_SHOP) {
      products = filterShopProductsByShopUrl(products, competitor.shopUrl);
    }
    await ingestCompetitorProducts(job.entityId, products);
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
}

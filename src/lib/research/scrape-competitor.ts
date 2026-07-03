import "server-only";

import { revalidatePath } from "next/cache";
import {
  ResearchScrapeJobStatus,
  ResearchScrapeJobType,
  ResearchMarketplace,
} from "@prisma/client";
import { assertDemoDataAllowed } from "@/lib/demo-data-policy";
import { toDbProvenance } from "@/lib/research/provenance-db";
import type { ScrapeDataProvider } from "@/lib/research/scrape-data-provider";
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
import { snapshotMetricsFromProduct } from "@/lib/research/shop-product-ingest";
import { runApifyJobToCompletion } from "@/lib/research/run-apify-job";
import { isScraperApiConfigured } from "@/lib/scraper-api/client";
import { fetchShopeeShopViaVps } from "@/lib/scraper-api/shopee-products";
import { fetchTokopediaShopViaVps } from "@/lib/scraper-api/tokopedia-products";

export async function enqueueCompetitorScrape(
  competitorId: string,
): Promise<void> {
  const competitor = await prisma.researchCompetitor.findUnique({
    where: { id: competitorId },
  });
  if (!competitor) throw new Error("Kompetitor tidak ditemukan.");

  if (
    competitor.marketplace === ResearchMarketplace.TOKOPEDIA &&
    isScraperApiConfigured()
  ) {
    const job = await prisma.researchScrapeJob.create({
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
      await ingestCompetitorProducts(competitorId, products, "vps");
      await prisma.researchScrapeJob.update({
        where: { id: job.id },
        data: {
          status: ResearchScrapeJobStatus.COMPLETED,
          completedAt: new Date(),
          error: null,
        },
      });
      revalidatePath("/research-hub/competitor-tracker");
      revalidatePath(`/research-hub/competitor-tracker/${competitorId}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Scrape kompetitor gagal.";
      await prisma.researchScrapeJob.update({
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

  if (
    competitor.marketplace === ResearchMarketplace.SHOPEE &&
    isScraperApiConfigured()
  ) {
    let shopeeProducts: NormalizedShopProduct[] | null = null;
    try {
      shopeeProducts = await fetchShopeeShopViaVps(competitor.shopUrl);
    } catch (err) {
      console.warn("[competitor/shopee/vps] gagal — fallback Apify", err);
    }

    if (shopeeProducts != null && shopeeProducts.length === 0) {
      console.warn(
        "[competitor/shopee/vps] kosong — fallback Apify",
        competitor.shopUrl,
      );
    }

    if (shopeeProducts != null && shopeeProducts.length > 0) {
      const job = await prisma.researchScrapeJob.create({
        data: {
          type: ResearchScrapeJobType.COMPETITOR_SNAPSHOT,
          entityId: competitorId,
          status: ResearchScrapeJobStatus.RUNNING,
          startedAt: new Date(),
        },
      });

      try {
        await ingestCompetitorProducts(competitorId, shopeeProducts, "vps");
        await prisma.researchScrapeJob.update({
          where: { id: job.id },
          data: {
            status: ResearchScrapeJobStatus.COMPLETED,
            completedAt: new Date(),
            error: null,
          },
        });
        revalidatePath("/research-hub/competitor-tracker");
        revalidatePath(`/research-hub/competitor-tracker/${competitorId}`);
        return;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Scrape kompetitor gagal.";
        await prisma.researchScrapeJob.update({
          where: { id: job.id },
          data: {
            status: ResearchScrapeJobStatus.FAILED,
            error: message,
            completedAt: new Date(),
          },
        });
        throw err;
      }
    }
  }

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
  // Fail-loud di produksi: jangan menulis SKU/snapshot fabrikasi tanpa izin eksplisit.
  assertDemoDataAllowed("Scraper kompetitor (VPS/Apify)");
  const products = generateDemoShopProducts();
  await ingestCompetitorProducts(competitorId, products, "demo");
}

export async function ingestCompetitorProducts(
  competitorId: string,
  products: NormalizedShopProduct[],
  provider?: ScrapeDataProvider,
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
        exactSold: product.exactSold,
        historicalSold: product.historicalSold,
        monthlySold: product.monthlySold,
        estimatedRevenue: product.estimatedRevenue,
        stock: product.stock,
        shopLocation: product.shopLocation,
        isOfficialShop: product.isOfficialShop,
      },
      update: {
        name: product.name,
        productUrl: product.productUrl,
        imageUrl: product.imageUrl ?? undefined,
        currentPrice: product.price,
        rating: product.rating,
        reviewCount: product.reviewCount,
        exactSold: product.exactSold,
        historicalSold: product.historicalSold,
        monthlySold: product.monthlySold,
        estimatedRevenue: product.estimatedRevenue,
        stock: product.stock,
        shopLocation: product.shopLocation,
        isOfficialShop: product.isOfficialShop,
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
        ...snapshotMetricsFromProduct(product),
      },
      { suppressNewSkuAlert: isInitialImport },
    );
  }

  if (provider) {
    const dbProvenance = toDbProvenance(provider);
    if (dbProvenance) {
      await prisma.researchCompetitor.update({
        where: { id: competitorId },
        data: { dataProvenance: dbProvenance },
      });
    }
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
    await ingestCompetitorProducts(job.entityId, products, "apify");
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

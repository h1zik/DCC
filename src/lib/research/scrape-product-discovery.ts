import "server-only";

import { after } from "next/server";

import {
  ProductDiscoveryStatus,
  ResearchMarketplace,
  ResearchScrapeJobStatus,
  ResearchScrapeJobType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildSearchActorInput,
  buildTikTokSearchActorInput,
  getSearchActorId,
} from "@/lib/apify/actors";
import {
  fetchApifyDataset,
  getApifyRunStatus,
  isApifyConfigured,
  startApifyActor,
} from "@/lib/apify/client";
import {
  extractDatasetScrapeErrors,
  generateDemoDiscoveryProducts,
  normalizeShopProducts,
  type NormalizedShopProduct,
} from "@/lib/apify/normalize";
import { filterShopProductsByKeyword } from "@/lib/apify/tiktok-kulqiz";
import {
  parseProductDiscoveryScrapeState,
  type ProductDiscoveryScrapeState,
} from "@/lib/research/product-discovery/scrape-state";
import { executeProductDiscoveryJob } from "@/lib/research/run-product-discovery-job";

export type DiscoveryProductInput = NormalizedShopProduct & {
  marketplace: ResearchMarketplace;
};

export async function enqueueProductDiscoveryScrape(
  queryId: string,
): Promise<void> {
  const query = await prisma.productDiscoveryQuery.findUnique({
    where: { id: queryId },
  });
  if (!query) throw new Error("Query product discovery tidak ditemukan.");

  const marketplaces =
    query.marketplaces.length > 0
      ? query.marketplaces
      : [ResearchMarketplace.SHOPEE];

  await prisma.productDiscoveryItem.deleteMany({ where: { queryId } });

  const scrapeState: ProductDiscoveryScrapeState = {
    marketplaces,
    nextIndex: 0,
    warnings: [],
  };

  await prisma.productDiscoveryQuery.update({
    where: { id: queryId },
    data: {
      status: ProductDiscoveryStatus.SCRAPING,
      errorMessage: null,
      productCount: 0,
      scrapeState,
    },
  });

  const job = await prisma.researchScrapeJob.create({
    data: {
      type: ResearchScrapeJobType.PRODUCT_DISCOVERY,
      entityId: queryId,
      status: ResearchScrapeJobStatus.PENDING,
      startedAt: new Date(),
    },
  });

  after(async () => {
    try {
      await executeProductDiscoveryJob(job.id);
    } catch (err) {
      console.error("[enqueueProductDiscoveryScrape]", job.id, err);
    }
  });
}

export async function ingestDiscoveryProductsBatch(
  queryId: string,
  products: DiscoveryProductInput[],
): Promise<number> {
  if (products.length === 0) return 0;

  await prisma.productDiscoveryItem.createMany({
    data: products.map((p) => ({
      queryId,
      marketplace: p.marketplace,
      externalId: p.externalId,
      name: p.name,
      productUrl: p.productUrl,
      shopName: p.shopName,
      price: p.price,
      rating: p.rating,
      reviewCount: p.reviewCount,
      soldCount: p.soldCount,
      hasPromo: p.hasPromo,
      promoText: p.promoText,
      categoryRank: p.categoryRank,
      imageUrl: p.imageUrl,
    })),
    skipDuplicates: true,
  });

  const count = await prisma.productDiscoveryItem.count({ where: { queryId } });
  await prisma.productDiscoveryQuery.update({
    where: { id: queryId },
    data: { productCount: count },
  });
  return count;
}

export async function runDemoProductDiscovery(queryId: string): Promise<void> {
  const query = await prisma.productDiscoveryQuery.findUnique({
    where: { id: queryId },
  });
  if (!query) return;

  const marketplaces =
    query.marketplaces.length > 0
      ? query.marketplaces
      : [ResearchMarketplace.SHOPEE];

  const perMarket = Math.ceil(query.productLimit / marketplaces.length);
  const products: DiscoveryProductInput[] = [];

  for (const mp of marketplaces) {
    const batch = generateDemoDiscoveryProducts(query.keyword, perMarket).map(
      (p, i) => ({
        ...p,
        externalId: `${mp.toLowerCase()}-${p.externalId}-${i}`,
        marketplace: mp,
      }),
    );
    products.push(...batch);
  }

  await ingestDiscoveryProductsBatch(
    queryId,
    products.slice(0, query.productLimit),
  );

  await prisma.productDiscoveryQuery.update({
    where: { id: queryId },
    data: {
      status: ProductDiscoveryStatus.READY,
      scrapeState: Prisma.JsonNull,
      errorMessage: "Data demo — Apify belum dikonfigurasi.",
    },
  });

  try {
    const { analyzeProductDiscovery } = await import(
      "@/lib/research/product-discovery/analyze-discovery"
    );
    await analyzeProductDiscovery(queryId);
  } catch (err) {
    console.error("[runDemoProductDiscovery] analisis gagal", err);
  }
}

export async function markProductDiscoveryFailed(
  queryId: string,
  jobId: string,
  message: string,
): Promise<void> {
  await prisma.researchScrapeJob.update({
    where: { id: jobId },
    data: {
      status: ResearchScrapeJobStatus.FAILED,
      error: message,
      completedAt: new Date(),
    },
  });
  await prisma.productDiscoveryQuery.update({
    where: { id: queryId },
    data: {
      status: ProductDiscoveryStatus.FAILED,
      errorMessage: message,
    },
  });
}

export async function finalizeProductDiscoveryJob(
  jobId: string,
  queryId: string,
  state: ProductDiscoveryScrapeState,
): Promise<void> {
  const count = await prisma.productDiscoveryItem.count({ where: { queryId } });
  const notice =
    state.warnings.length > 0 ? state.warnings.join(" | ") : null;

  if (count === 0) {
    await markProductDiscoveryFailed(
      queryId,
      jobId,
      notice ?? "Tidak ada produk ditemukan untuk keyword ini.",
    );
    return;
  }

  await prisma.productDiscoveryQuery.update({
    where: { id: queryId },
    data: {
      status: ProductDiscoveryStatus.READY,
      productCount: count,
      errorMessage: notice,
      scrapeState: Prisma.JsonNull,
    },
  });

  await prisma.researchScrapeJob.update({
    where: { id: jobId },
    data: {
      status: ResearchScrapeJobStatus.COMPLETED,
      completedAt: new Date(),
      error: null,
      apifyRunId: null,
    },
  });

  try {
    const { analyzeProductDiscovery } = await import(
      "@/lib/research/product-discovery/analyze-discovery"
    );
    await analyzeProductDiscovery(queryId);
  } catch (err) {
    console.error("[finalizeProductDiscoveryJob] analisis gagal", err);
  }
}

export async function startNextMarketplaceRun(jobId: string): Promise<void> {
  const job = await prisma.researchScrapeJob.findUnique({ where: { id: jobId } });
  if (!job) return;

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

  const state = parseProductDiscoveryScrapeState(
    query.scrapeState,
    query.marketplaces,
  );

  while (state.nextIndex < state.marketplaces.length) {
    const currentCount = await prisma.productDiscoveryItem.count({
      where: { queryId: query.id },
    });
    if (currentCount >= query.productLimit) {
      await finalizeProductDiscoveryJob(jobId, query.id, state);
      return;
    }

    const mp = state.marketplaces[state.nextIndex]!;
    const remaining = query.productLimit - currentCount;
    const actorId = getSearchActorId(mp);

    if (!actorId) {
      state.warnings.push(`${mp}: actor search belum dikonfigurasi.`);
      state.nextIndex += 1;
      continue;
    }

    const actorInput =
      mp === ResearchMarketplace.TIKTOK_SHOP
        ? buildTikTokSearchActorInput(
            actorId,
            query.keyword,
            remaining,
            state.tiktokKulqizExpandSubcategories === true,
          )
        : buildSearchActorInput(mp, query.keyword, remaining);

    const { runId } = await startApifyActor(actorId, actorInput);

    await prisma.researchScrapeJob.update({
      where: { id: jobId },
      data: {
        status: ResearchScrapeJobStatus.RUNNING,
        apifyRunId: runId,
        startedAt: job.startedAt ?? new Date(),
      },
    });
    await prisma.productDiscoveryQuery.update({
      where: { id: query.id },
      data: { scrapeState: state },
    });
    return;
  }

  await finalizeProductDiscoveryJob(jobId, query.id, state);
}

export async function pollProductDiscoveryJob(jobId: string): Promise<void> {
  const job = await prisma.researchScrapeJob.findUnique({ where: { id: jobId } });
  if (!job?.apifyRunId || job.type !== ResearchScrapeJobType.PRODUCT_DISCOVERY) {
    return;
  }
  if (
    job.status === ResearchScrapeJobStatus.COMPLETED ||
    job.status === ResearchScrapeJobStatus.FAILED
  ) {
    return;
  }

  const query = await prisma.productDiscoveryQuery.findUnique({
    where: { id: job.entityId },
  });
  if (!query) return;

  const state = parseProductDiscoveryScrapeState(
    query.scrapeState,
    query.marketplaces,
  );
  const mp = state.marketplaces[state.nextIndex];

  const { status, datasetId } = await getApifyRunStatus(job.apifyRunId);
  if (status === "RUNNING" || status === "READY") return;

  if (status === "SUCCEEDED" && mp) {
    try {
      const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
      const datasetError = extractDatasetScrapeErrors(items);
      const currentCount = await prisma.productDiscoveryItem.count({
        where: { queryId: query.id },
      });
      const remaining = query.productLimit - currentCount;
      let normalized = normalizeShopProducts(items);
      if (mp === ResearchMarketplace.TIKTOK_SHOP) {
        normalized = filterShopProductsByKeyword(normalized, query.keyword);
      }
      const products = normalized
        .slice(0, remaining)
        .map((p) => ({ ...p, marketplace: mp }));

      if (products.length === 0) {
        if (
          mp === ResearchMarketplace.TIKTOK_SHOP &&
          !state.tiktokKulqizExpandSubcategories &&
          items.length > 0
        ) {
          state.tiktokKulqizExpandSubcategories = true;
          state.warnings.push(
            `${mp}: pass 1 tidak menemukan produk cocok — mencoba subkategori (max 60).`,
          );
          await prisma.researchScrapeJob.update({
            where: { id: jobId },
            data: { apifyRunId: null },
          });
          await prisma.productDiscoveryQuery.update({
            where: { id: query.id },
            data: { scrapeState: state },
          });
          await startNextMarketplaceRun(jobId);
          return;
        }

        const detail =
          datasetError ??
          (items.length === 0
            ? "dataset kosong"
            : mp === ResearchMarketplace.TIKTOK_SHOP
              ? "tidak ada produk cocok keyword di kategori beauty TikTok Shop ID"
              : "format produk tidak dikenali");
        state.warnings.push(`${mp}: ${detail}`);
      } else {
        await ingestDiscoveryProductsBatch(query.id, products);
        if (
          mp === ResearchMarketplace.TIKTOK_SHOP &&
          products.length < remaining &&
          !state.tiktokKulqizExpandSubcategories
        ) {
          state.warnings.push(
            `${mp}: hanya ${products.length} produk cocok keyword (limit ${query.productLimit}).`,
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ingest gagal";
      state.warnings.push(`${mp}: ${msg}`);
    }
  } else if (mp) {
    state.warnings.push(`${mp}: scrape gagal (${status}).`);
  }

  if (mp === ResearchMarketplace.TIKTOK_SHOP) {
    state.tiktokKulqizExpandSubcategories = false;
  }
  state.nextIndex += 1;
  await prisma.researchScrapeJob.update({
    where: { id: jobId },
    data: { apifyRunId: null },
  });
  await prisma.productDiscoveryQuery.update({
    where: { id: query.id },
    data: { scrapeState: state },
  });

  await startNextMarketplaceRun(jobId);
}

export function isApifyReadyForDiscovery(): boolean {
  return isApifyConfigured();
}

import "server-only";

import { revalidatePath } from "next/cache";
import {
  Prisma,
  ResearchMarketplace,
  ResearchScrapeJobStatus,
  ResearchScrapeJobType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildReviewActorInputByPlatformKey,
  getReviewActorIdByPlatformKey,
  marketplaceToPlatformKey,
  reviewActorEnvHintByPlatformKey,
} from "@/lib/apify/actors";
import {
  fetchApifyDataset,
  isApifyConfigured,
  startApifyActor,
  waitForApifyRun,
} from "@/lib/apify/client";
import {
  extractApifyScrapeErrorMessage,
  generateDemoShopProducts,
  normalizeShopProducts,
  type NormalizedShopProduct,
} from "@/lib/apify/normalize";
import { cleanShopeeUrl } from "@/lib/apify/shopee-url";
import { applyCompetitorProductSnapshot } from "@/lib/research/competitor-product-diff";
import { snapshotMetricsFromProduct } from "@/lib/research/shop-product-ingest";
import { isScraperApiConfigured } from "@/lib/scraper-api/client";
import { fetchMarketplaceProductViaVps } from "@/lib/scraper-api/marketplace-product-via-vps";

function normalizeProductDetailItems(
  items: Record<string, unknown>[],
  productUrl: string,
): NormalizedShopProduct[] {
  const cleanedUrl =
    productUrl.includes("shopee.") ? cleanShopeeUrl(productUrl) : productUrl;

  const patched = items.map((item) => {
    const hasUrl =
      typeof item.url === "string" ||
      typeof item.productUrl === "string" ||
      typeof item.link === "string";
    if (hasUrl) return item;
    return { ...item, url: cleanedUrl, productUrl: cleanedUrl };
  });

  let products = normalizeShopProducts(patched);
  if (products.length > 0) return products;

  const item = patched.find((x) => x.error == null);
  if (!item) return [];

  const title =
    (typeof item.title === "string" && item.title) ||
    (typeof item.name === "string" && item.name) ||
    (typeof item.productName === "string" && item.productName) ||
    "Produk";

  products = normalizeShopProducts([
    {
      ...item,
      name: title,
      title,
      url: cleanedUrl,
      productUrl: cleanedUrl,
    },
  ]);

  return products;
}

async function fetchProductDetailFromApify(
  productUrl: string,
  marketplace: ResearchMarketplace,
): Promise<NormalizedShopProduct> {
  const platformKey = marketplaceToPlatformKey(marketplace);
  const actorId = getReviewActorIdByPlatformKey(platformKey);
  if (!actorId) {
    throw new Error(reviewActorEnvHintByPlatformKey(platformKey));
  }

  const input = buildReviewActorInputByPlatformKey(platformKey, productUrl);
  const { runId } = await startApifyActor(actorId, input);
  const { status, datasetId } = await waitForApifyRun(runId);

  if (status !== "SUCCEEDED") {
    throw new Error(`Scrape produk gagal (status: ${status}).`);
  }

  const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
  const apifyError = extractApifyScrapeErrorMessage(items);
  if (apifyError) throw new Error(apifyError);

  const products = normalizeProductDetailItems(items, productUrl);
  if (products.length === 0) {
    throw new Error(
      "Tidak ada data produk dari scraper. Pastikan URL produk valid.",
    );
  }

  return products[0]!;
}

async function fetchProductDetail(
  productUrl: string,
  marketplace: ResearchMarketplace,
): Promise<NormalizedShopProduct> {
  if (isScraperApiConfigured()) {
    try {
      return await fetchMarketplaceProductViaVps(marketplace, productUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[competitor-product/${marketplace.toLowerCase()}/vps] gagal — fallback Apify:`,
        msg,
      );
    }
  }

  if (isApifyConfigured()) {
    return fetchProductDetailFromApify(productUrl, marketplace);
  }

  if (isScraperApiConfigured()) {
    throw new Error(
      "Scrape VPS gagal dan Apify tidak dikonfigurasi. Periksa URL produk atau SCRAPER_API_URL.",
    );
  }

  return demoProductForUrl(productUrl);
}

function demoProductForUrl(productUrl: string): NormalizedShopProduct {
  const base = generateDemoShopProducts()[0]!;
  return {
    ...base,
    externalId: `demo-${Buffer.from(productUrl).toString("base64url").slice(0, 16)}`,
    productUrl,
    name: `${base.name} (demo)`,
  };
}

export async function scrapeCompetitorProductTrack(
  trackId: string,
): Promise<void> {
  const track = await prisma.competitorProductTrack.findUnique({
    where: { id: trackId },
    include: { category: { select: { id: true } } },
  });
  if (!track) throw new Error("Produk tidak ditemukan.");

  const job = await prisma.researchScrapeJob.create({
    data: {
      type: ResearchScrapeJobType.COMPETITOR_PRODUCT_SNAPSHOT,
      entityId: trackId,
      status: ResearchScrapeJobStatus.RUNNING,
      startedAt: new Date(),
    },
  });

  try {
    const product = await fetchProductDetail(track.productUrl, track.marketplace);

    const metrics = snapshotMetricsFromProduct(product);

    // Detail kaya dari scraper (VPS shopee-product). `undefined` = jangan ubah
    // field lama bila marketplace ini tidak menyediakannya.
    const richData: Prisma.CompetitorProductTrackUpdateInput = {
      brand: product.brand ?? undefined,
      description: product.description ?? undefined,
      categoryName: product.category ?? undefined,
      currency: product.currency ?? undefined,
    };
    if (product.categoryPath && product.categoryPath.length > 0) {
      richData.categoryPath = product.categoryPath;
    }
    if (product.attributes && product.attributes.length > 0) {
      richData.attributes = product.attributes as unknown as Prisma.InputJsonValue;
    }
    if (product.variations && product.variations.length > 0) {
      richData.variations = product.variations as unknown as Prisma.InputJsonValue;
    }
    if (product.models && product.models.length > 0) {
      richData.models = product.models as unknown as Prisma.InputJsonValue;
    }
    if (
      product.ratingDistribution &&
      Object.keys(product.ratingDistribution).length > 0
    ) {
      richData.ratingDistribution =
        product.ratingDistribution as unknown as Prisma.InputJsonValue;
    }
    if (product.imageUrls && product.imageUrls.length > 0) {
      richData.imageUrls = product.imageUrls;
    }

    await prisma.competitorProductTrack.update({
      where: { id: trackId },
      data: {
        externalId: product.externalId,
        name: product.name,
        imageUrl: product.imageUrl,
        shopName: product.shopName ?? track.shopName,
        currentPrice: product.price,
        rating: product.rating,
        reviewCount: product.reviewCount ?? 0,
        exactSold: metrics.exactSold,
        historicalSold: metrics.historicalSold,
        monthlySold: metrics.monthlySold,
        estimatedRevenue: metrics.estimatedRevenue,
        stock: metrics.stock,
        hasPromo: product.hasPromo,
        promoText: product.promoText,
        lastScrapedAt: new Date(),
        lastSeenAt: new Date(),
        scrapeError: null,
        ...richData,
      },
    });

    await applyCompetitorProductSnapshot(track.category.id, trackId, {
      price: product.price,
      rating: product.rating,
      reviewCount: product.reviewCount ?? 0,
      exactSold: metrics.exactSold,
      historicalSold: metrics.historicalSold,
      monthlySold: metrics.monthlySold,
      estimatedRevenue: metrics.estimatedRevenue,
      stock: metrics.stock,
      hasPromo: product.hasPromo,
      promoText: product.promoText,
    });

    await prisma.researchScrapeJob.update({
      where: { id: job.id },
      data: {
        status: ResearchScrapeJobStatus.COMPLETED,
        completedAt: new Date(),
        error: null,
      },
    });

    // Surfaced under both hubs — invalidate both prefixes so neither stays stale.
    for (const base of [
      "/research-hub/competitor-tracker/products",
      "/brand-hub/competitor-tracker/products",
    ]) {
      revalidatePath(base);
      revalidatePath(`${base}/${track.category.id}`);
      revalidatePath(`${base}/${track.category.id}/tracks/${trackId}`);
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Scrape produk kompetitor gagal.";
    await prisma.competitorProductTrack.update({
      where: { id: trackId },
      data: { scrapeError: message },
    });
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

export async function enqueueCompetitorProductTrackScrape(
  trackId: string,
): Promise<void> {
  await scrapeCompetitorProductTrack(trackId);
}

export async function enqueueCategoryProductScrapes(
  categoryId: string,
): Promise<void> {
  const tracks = await prisma.competitorProductTrack.findMany({
    where: { categoryId, isActive: true },
    select: { id: true },
  });

  for (const track of tracks) {
    try {
      await scrapeCompetitorProductTrack(track.id);
    } catch (err) {
      console.error("[competitor-product] scrape gagal", track.id, err);
    }
  }
}

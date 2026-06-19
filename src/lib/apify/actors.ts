import "server-only";

import { ResearchMarketplace, ResearchScrapeJobType } from "@prisma/client";
import { cleanShopeeUrl } from "@/lib/apify/shopee-url";
import { isApifyConfigured } from "@/lib/apify/client";
import {
  buildKulqizDiscoveryInput,
  buildKulqizReviewInput,
  buildKulqizShopInput,
  isKulqizTikTokShopActor,
} from "@/lib/apify/tiktok-kulqiz";
import {
  buildReviewActorInputForPlatform,
  getReviewActorIdForPlatform,
  reviewPlatformEnvHint,
} from "@/lib/review-platforms/registry";
import { marketplaceFromPlatformKey } from "@/lib/review-platforms/platforms";

const GIO21_SHOPEE_SCRAPER = "gio21~shopee-scraper";
const GIO21_SHOPEE_PRODUCT_DETAIL = "gio21~shopee-product-detail";

function normalizeActorId(actorId: string | null): string {
  return (actorId ?? "").replace(/\//g, "~").toLowerCase();
}

export function getReviewActorId(marketplace: ResearchMarketplace): string | null {
  switch (marketplace) {
    case ResearchMarketplace.SHOPEE:
      return process.env.APIFY_ACTOR_SHOPEE_REVIEWS?.trim() || null;
    case ResearchMarketplace.TOKOPEDIA:
      return process.env.APIFY_ACTOR_TOKOPEDIA_REVIEWS?.trim() || null;
    case ResearchMarketplace.TIKTOK_SHOP:
      return process.env.APIFY_ACTOR_TIKTOK_REVIEWS?.trim() || null;
    default:
      return null;
  }
}

/** Resolve review actor by platform registry key. */
export { getReviewActorIdForPlatform as getReviewActorIdByPlatformKey };

export function buildReviewActorInputByPlatformKey(
  platformKey: string,
  productUrl: string,
): Record<string, unknown> {
  return buildReviewActorInputForPlatform(platformKey, productUrl);
}

export function reviewActorEnvHintByPlatformKey(platformKey: string): string {
  return reviewPlatformEnvHint(platformKey);
}

export function marketplaceToPlatformKey(
  marketplace: ResearchMarketplace,
): string {
  return marketplaceFromPlatformKey(marketplace) ?? "shopee";
}

export function getShopActorId(marketplace: ResearchMarketplace): string | null {
  switch (marketplace) {
    case ResearchMarketplace.SHOPEE:
      return process.env.APIFY_ACTOR_SHOPEE_SHOP?.trim() || null;
    case ResearchMarketplace.TOKOPEDIA:
      return process.env.APIFY_ACTOR_TOKOPEDIA_SHOP?.trim() || null;
    case ResearchMarketplace.TIKTOK_SHOP:
      return process.env.APIFY_ACTOR_TIKTOK_SHOP?.trim() || null;
    default:
      return null;
  }
}

/** Deteksi kode negara Shopee dari URL (default Indonesia). */
export function shopeeCountryFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("shopee.co.id")) return "ID";
    if (host.includes("shopee.com.br")) return "BR";
    if (host.includes("shopee.sg")) return "SG";
    if (host.includes("shopee.com.my")) return "MY";
    if (host.includes("shopee.co.th")) return "TH";
    if (host.includes("shopee.vn")) return "VN";
    if (host.includes("shopee.ph")) return "PH";
    if (host.includes("shopee.com.mx")) return "MX";
  } catch {
    /* ignore */
  }
  return "ID";
}

function isGio21ProductDetailActor(actorId: string | null): boolean {
  if (!actorId) return false;
  const n = normalizeActorId(actorId);
  return n.includes("shopee-product-detail") || n === GIO21_SHOPEE_PRODUCT_DETAIL;
}

function isGio21ShopeeScraperActor(actorId: string | null): boolean {
  if (!actorId) return false;
  const n = normalizeActorId(actorId);
  return (
    (n.includes("gio21") && n.includes("shopee-scraper")) ||
    n === GIO21_SHOPEE_SCRAPER
  );
}

export function buildTikTokSearchActorInput(
  actorId: string | null,
  _keyword: string,
  productLimit: number,
  expandSubcategories = false,
): Record<string, unknown> {
  if (isKulqizTikTokShopActor(actorId)) {
    return buildKulqizDiscoveryInput(productLimit, expandSubcategories);
  }
  const limit = Math.min(Math.max(productLimit, 1), 500);
  return { searchKeywords: [_keyword.trim()], maxProducts: Math.max(limit, 20) };
}

export function buildReviewActorInput(
  marketplace: ResearchMarketplace,
  productUrl: string,
): Record<string, unknown> {
  const actorId = getReviewActorId(marketplace);

  switch (marketplace) {
    case ResearchMarketplace.SHOPEE:
      if (isGio21ProductDetailActor(actorId)) {
        const url = cleanShopeeUrl(productUrl);
        return {
          productUrls: [url],
          country: shopeeCountryFromUrl(url),
          includeReviews: true,
          reviewsLimit: 500,
        };
      }
      return { productUrls: [productUrl], maxReviews: 500 };
    case ResearchMarketplace.TOKOPEDIA:
      return {
        product_url: productUrl,
        results_wanted: 500,
        max_pages: 50,
      };
    case ResearchMarketplace.TIKTOK_SHOP:
      if (isKulqizTikTokShopActor(actorId)) {
        return buildKulqizReviewInput(productUrl);
      }
      return { url: productUrl, maxReviews: 500 };
    default:
      return { url: productUrl, maxReviews: 500 };
  }
}

export function buildShopActorInput(
  marketplace: ResearchMarketplace,
  shopUrl: string,
): Record<string, unknown> {
  const actorId = getShopActorId(marketplace);

  switch (marketplace) {
    case ResearchMarketplace.SHOPEE:
      if (isGio21ShopeeScraperActor(actorId)) {
        const url = cleanShopeeUrl(shopUrl);
        return {
          shopUrls: [url],
          country: shopeeCountryFromUrl(url),
          maxItems: 100,
        };
      }
      return { shopUrls: [shopUrl], maxProducts: 100 };
    case ResearchMarketplace.TOKOPEDIA:
      return { shopUrl, maxProducts: 100 };
    case ResearchMarketplace.TIKTOK_SHOP:
      if (isKulqizTikTokShopActor(actorId)) {
        return buildKulqizShopInput(shopUrl);
      }
      return { urls: [shopUrl.trim()], maxProducts: 100 };
    default:
      return { url: shopUrl, maxProducts: 100 };
  }
}

export function getSearchActorId(
  marketplace: ResearchMarketplace,
): string | null {
  switch (marketplace) {
    case ResearchMarketplace.SHOPEE:
      return process.env.APIFY_ACTOR_SHOPEE_SHOP?.trim() || null;
    case ResearchMarketplace.TOKOPEDIA:
      return (
        process.env.APIFY_ACTOR_TOKOPEDIA_SEARCH?.trim() ||
        process.env.APIFY_ACTOR_TOKOPEDIA_SHOP?.trim() ||
        null
      );
    case ResearchMarketplace.TIKTOK_SHOP:
      return (
        process.env.APIFY_ACTOR_TIKTOK_SEARCH?.trim() ||
        process.env.APIFY_ACTOR_TIKTOK_SHOP?.trim() ||
        null
      );
    default:
      return null;
  }
}

export function isProductSearchConfigured(
  marketplace: ResearchMarketplace,
): boolean {
  return isApifyConfigured() && !!getSearchActorId(marketplace);
}

export function buildSearchActorInput(
  marketplace: ResearchMarketplace,
  keyword: string,
  productLimit: number,
): Record<string, unknown> {
  const actorId = getSearchActorId(marketplace);
  const limit = Math.min(Math.max(productLimit, 1), 500);

  switch (marketplace) {
    case ResearchMarketplace.SHOPEE:
      if (isGio21ShopeeScraperActor(actorId)) {
        return {
          location: keyword.trim(),
          country: "ID",
          maxItems: limit,
        };
      }
      return { keywords: [keyword.trim()], maxProducts: limit };
    case ResearchMarketplace.TOKOPEDIA:
      return { keyword: keyword.trim(), maxProducts: limit };
    case ResearchMarketplace.TIKTOK_SHOP:
      return buildTikTokSearchActorInput(actorId, keyword, limit);
    default:
      return { search: keyword.trim(), maxProducts: limit };
  }
}

export function searchActorEnvHint(marketplace: ResearchMarketplace): string {
  switch (marketplace) {
    case ResearchMarketplace.SHOPEE:
      return "Set APIFY_ACTOR_SHOPEE_SHOP (gio21~shopee-scraper mendukung keyword search).";
    case ResearchMarketplace.TOKOPEDIA:
      return "Set APIFY_ACTOR_TOKOPEDIA_SEARCH atau APIFY_ACTOR_TOKOPEDIA_SHOP.";
    default:
      return "Set APIFY_ACTOR_TIKTOK_SEARCH (kulqiz~tiktok-shop-scraper).";
  }
}

export function actorEnvHint(
  type: ResearchScrapeJobType,
  marketplace: ResearchMarketplace,
): string {
  if (type === ResearchScrapeJobType.REVIEW_SCRAPE) {
    if (marketplace === ResearchMarketplace.TIKTOK_SHOP) {
      return "Set APIFY_ACTOR_TIKTOK_REVIEWS (kulqiz~tiktok-shop-scraper).";
    }
    return `Set env APIFY_ACTOR_*_REVIEWS untuk ${marketplace} (Shopee: gio21~shopee-product-detail).`;
  }
  if (marketplace === ResearchMarketplace.TIKTOK_SHOP) {
    return "Set APIFY_ACTOR_TIKTOK_SHOP (kulqiz~tiktok-shop-scraper).";
  }
  return `Set env APIFY_ACTOR_*_SHOP untuk ${marketplace} (Shopee: gio21~shopee-scraper).`;
}

export function getPinterestActorId(): string | null {
  return process.env.APIFY_ACTOR_PINTEREST?.trim() || "silentflow~pinterest-scraper-ppr";
}

export function getPinterestMaxPinsPerKeyword(): number {
  const raw = process.env.BRAND_PINTEREST_MAX_PINS_PER_KEYWORD?.trim();
  const n = raw ? Number(raw) : 80;
  if (!Number.isFinite(n)) return 80;
  return Math.min(Math.max(Math.round(n), 10), 200);
}

export function buildPinterestActorInput(
  keyword: string,
  maxItems?: number,
): Record<string, unknown> {
  const search = keyword.trim();
  if (!search) {
    throw new Error("Keyword Pinterest kosong.");
  }
  return {
    search,
    maxItems: maxItems ?? getPinterestMaxPinsPerKeyword(),
    includeDetails: false,
    includeUserInfoOnly: false,
  };
}

export function pinterestActorEnvHint(): string {
  return "Set APIFY_ACTOR_PINTEREST (default: silentflow~pinterest-scraper-ppr).";
}

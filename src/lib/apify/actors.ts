import "server-only";

import { ResearchMarketplace, ResearchScrapeJobType } from "@prisma/client";
import {
  buildShopeeSearchInput,
  buildShopeeShopInput,
  getShopeeReviewsActorId,
  getShopeeSearchActorId,
  getShopeeShopActorId,
  SHOPEE_ACTOR_DEFAULTS,
} from "@/lib/apify/shopee-actors";
import { isApifyConfigured } from "@/lib/apify/client";
import { isScraperApiConfigured } from "@/lib/scraper-api/client";
import {
  buildKulqizDiscoveryInput,
  buildKulqizShopInput,
  isKulqizTikTokShopActor,
  KULQIZ_TIKTOK_SHOP_ACTOR,
} from "@/lib/apify/tiktok-kulqiz";
import {
  buildTokopediaSearchInput,
  buildTokopediaShopInput,
  getTokopediaReviewsActorId,
  getTokopediaSearchActorId,
  getTokopediaShopActorId,
  TOKOPEDIA_ACTOR_DEFAULTS,
} from "@/lib/apify/tokopedia-actors";
import {
  buildReviewActorInputForPlatform,
  getReviewActorIdForPlatform,
  reviewPlatformEnvHint,
} from "@/lib/review-platforms/registry";
import { marketplaceFromPlatformKey } from "@/lib/review-platforms/platforms";

function tikTokShopActorId(envKey: string): string {
  return process.env[envKey]?.trim() || KULQIZ_TIKTOK_SHOP_ACTOR;
}

export function getReviewActorId(marketplace: ResearchMarketplace): string | null {
  switch (marketplace) {
    case ResearchMarketplace.SHOPEE:
      return getShopeeReviewsActorId();
    case ResearchMarketplace.TOKOPEDIA:
      return getTokopediaReviewsActorId();
    case ResearchMarketplace.TIKTOK_SHOP:
      return tikTokShopActorId("APIFY_ACTOR_TIKTOK_REVIEWS");
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
      return getShopeeShopActorId();
    case ResearchMarketplace.TOKOPEDIA:
      return getTokopediaShopActorId();
    case ResearchMarketplace.TIKTOK_SHOP:
      return tikTokShopActorId("APIFY_ACTOR_TIKTOK_SHOP");
    default:
      return null;
  }
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

export function buildShopActorInput(
  marketplace: ResearchMarketplace,
  shopUrl: string,
): Record<string, unknown> {
  const actorId = getShopActorId(marketplace);

  switch (marketplace) {
    case ResearchMarketplace.SHOPEE:
      return buildShopeeShopInput(shopUrl);
    case ResearchMarketplace.TOKOPEDIA:
      return buildTokopediaShopInput(shopUrl);
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
      return getShopeeSearchActorId();
    case ResearchMarketplace.TOKOPEDIA:
      return getTokopediaSearchActorId();
    case ResearchMarketplace.TIKTOK_SHOP:
      return (
        process.env.APIFY_ACTOR_TIKTOK_SEARCH?.trim() ||
        tikTokShopActorId("APIFY_ACTOR_TIKTOK_SHOP")
      );
    default:
      return null;
  }
}

/** Shopee / Tokopedia / TikTok Shop lewat Apify; Lazada lewat scraper VPS. */
export function isProductSearchConfigured(
  marketplace: ResearchMarketplace,
): boolean {
  if (marketplace === ResearchMarketplace.LAZADA) {
    return isScraperApiConfigured();
  }
  return isApifyConfigured() && !!getSearchActorId(marketplace);
}

export function isShopScrapeConfigured(
  marketplace: ResearchMarketplace,
): boolean {
  return isApifyConfigured() && !!getShopActorId(marketplace);
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
      return buildShopeeSearchInput(keyword, limit);
    case ResearchMarketplace.TOKOPEDIA:
      return buildTokopediaSearchInput(keyword, limit);
    case ResearchMarketplace.TIKTOK_SHOP:
      return buildTikTokSearchActorInput(actorId, keyword, limit);
    default:
      return { search: keyword.trim(), maxProducts: limit };
  }
}

export function searchActorEnvHint(marketplace: ResearchMarketplace): string {
  switch (marketplace) {
    case ResearchMarketplace.SHOPEE:
      return `Set APIFY_API_TOKEN (actor APIFY_ACTOR_SHOPEE_SEARCH, default ${SHOPEE_ACTOR_DEFAULTS.search}).`;
    case ResearchMarketplace.TOKOPEDIA:
      return `Set APIFY_API_TOKEN (actor APIFY_ACTOR_TOKOPEDIA_SEARCH, default ${TOKOPEDIA_ACTOR_DEFAULTS.search}).`;
    case ResearchMarketplace.LAZADA:
      return "Lazada search via VPS — set SCRAPER_API_URL + SCRAPER_API_KEY.";
    default:
      return `Set APIFY_API_TOKEN (actor APIFY_ACTOR_TIKTOK_SEARCH, default ${KULQIZ_TIKTOK_SHOP_ACTOR}).`;
  }
}

export function actorEnvHint(
  type: ResearchScrapeJobType,
  marketplace: ResearchMarketplace,
): string {
  const isReview = type === ResearchScrapeJobType.REVIEW_SCRAPE;
  const suffix = isReview ? "REVIEWS" : "SHOP";
  switch (marketplace) {
    case ResearchMarketplace.SHOPEE:
      return `Set APIFY_ACTOR_SHOPEE_${suffix} (default ${
        isReview ? SHOPEE_ACTOR_DEFAULTS.reviews : SHOPEE_ACTOR_DEFAULTS.shop
      }).`;
    case ResearchMarketplace.TOKOPEDIA:
      return `Set APIFY_ACTOR_TOKOPEDIA_${suffix} (default ${
        isReview ? TOKOPEDIA_ACTOR_DEFAULTS.reviews : TOKOPEDIA_ACTOR_DEFAULTS.shop
      }).`;
    case ResearchMarketplace.TIKTOK_SHOP:
      return `Set APIFY_ACTOR_TIKTOK_${suffix} (default ${KULQIZ_TIKTOK_SHOP_ACTOR}).`;
    default:
      return `Scrape ${isReview ? "review" : "toko"} ${marketplace} belum didukung lewat Apify.`;
  }
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
  return "Set SCRAPER_API_URL (VPS) atau APIFY_ACTOR_PINTEREST untuk scrape Pinterest.";
}

export function getMetaAdLibraryActorId(): string | null {
  return (
    process.env.APIFY_ACTOR_META_AD_LIBRARY?.trim() ||
    "automly~facebook-ad-library-scraper"
  );
}

export function buildMetaAdLibraryActorInput(monitor: {
  searchTerms: string[];
  adLibraryUrls: string[];
  country: string;
  activeStatus: string;
  adType: string;
  mediaType: string;
  searchType: string;
  maxAds: number;
}): Record<string, unknown> {
  const searchTerms = monitor.searchTerms.map((t) => t.trim()).filter(Boolean);
  const urls = monitor.adLibraryUrls.map((u) => u.trim()).filter(Boolean);
  if (searchTerms.length === 0 && urls.length === 0) {
    throw new Error("Isi minimal satu keyword atau URL Ad Library.");
  }

  // PENTING: actor ini memakai `maxAds` PER search term / URL, BUKAN total.
  // Jadi total iklan yang di-scrape = maxAds × (jumlah keyword + jumlah URL).
  // Agar menghormati target jumlah HASIL AKHIR milik user, kita bagi target ke
  // tiap unit pencarian. Hard cap actor = 200 per unit.
  const target = Math.min(Math.max(monitor.maxAds || 50, 10), 200);
  const unitCount = Math.max(searchTerms.length + urls.length, 1);
  const perUnit = Math.min(Math.max(Math.ceil(target / unitCount), 1), 200);

  const input: Record<string, unknown> = {
    country: monitor.country || "ID",
    activeStatus: monitor.activeStatus || "active",
    adType: monitor.adType || "all",
    mediaType: monitor.mediaType || "all",
    searchType: monitor.searchType || "keyword_exact_phrase",
    maxAds: perUnit,
    // Aktif: ambil transparansi halaman (total iklan aktif, tanggal dibuat) —
    // berguna untuk menilai seberapa agresif kompetitor beriklan.
    includePageTransparency: true,
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: ["RESIDENTIAL"],
    },
  };

  if (searchTerms.length > 0) input.searchTerms = searchTerms;
  if (urls.length > 0) input.urls = urls;

  return input;
}

export function metaAdLibraryActorEnvHint(): string {
  return "Set APIFY_ACTOR_META_AD_LIBRARY atau gunakan default automly~facebook-ad-library-scraper.";
}

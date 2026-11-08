import "server-only";

import { cleanShopeeUrl } from "@/lib/apify/shopee-url";

/**
 * Actor Apify untuk Shopee (cadangan setelah scraper VPS).
 *
 * | Kebutuhan            | Env                           | Default                                   |
 * |----------------------|-------------------------------|-------------------------------------------|
 * | Cari per keyword     | APIFY_ACTOR_SHOPEE_SEARCH     | xtracto~shopee-search                     |
 * | Produk satu toko     | APIFY_ACTOR_SHOPEE_SHOP       | xtracto~shopee-shop-scraper               |
 * | Detail satu produk   | APIFY_ACTOR_SHOPEE_PRODUCT    | xtracto~shopee-scraper (mode `url`)       |
 * | Review               | APIFY_ACTOR_SHOPEE_REVIEWS    | dami_studio~shopee-shop-reviews-scraper   |
 * | Autocomplete keyword | APIFY_ACTOR_SHOPEE_AUTOCOMPLETE | xtracto~shopee-search-hint (lihat shopee-autocomplete.ts) |
 */
export const SHOPEE_ACTOR_DEFAULTS = {
  search: "xtracto~shopee-search",
  shop: "xtracto~shopee-shop-scraper",
  product: "xtracto~shopee-scraper",
  reviews: "dami_studio~shopee-shop-reviews-scraper",
} as const;

export const SHOPEE_REVIEW_LIMIT = 500;
export const SHOPEE_SHOP_PRODUCT_LIMIT = 100;

function readEnv(key: string): string | null {
  return process.env[key]?.trim() || null;
}

export function normalizeShopeeActorId(actorId: string | null): string {
  return (actorId ?? "").replace(/\//g, "~").toLowerCase();
}

export function getShopeeSearchActorId(): string {
  return readEnv("APIFY_ACTOR_SHOPEE_SEARCH") ?? SHOPEE_ACTOR_DEFAULTS.search;
}

export function getShopeeShopActorId(): string {
  return readEnv("APIFY_ACTOR_SHOPEE_SHOP") ?? SHOPEE_ACTOR_DEFAULTS.shop;
}

export function getShopeeProductActorId(): string {
  return readEnv("APIFY_ACTOR_SHOPEE_PRODUCT") ?? SHOPEE_ACTOR_DEFAULTS.product;
}

export function getShopeeReviewsActorId(): string {
  return readEnv("APIFY_ACTOR_SHOPEE_REVIEWS") ?? SHOPEE_ACTOR_DEFAULTS.reviews;
}

/** Kode negara Shopee (huruf besar) dari hostname URL; default Indonesia. */
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
    if (host.includes("shopee.tw")) return "TW";
    if (host.includes("shopee.com.co")) return "CO";
    if (host.includes("shopee.cl")) return "CL";
  } catch {
    /* ignore */
  }
  return "ID";
}

/** xtracto/shopee-search — `{mode:"keyword"}`. */
export function buildShopeeSearchInput(
  keyword: string,
  productLimit: number,
  country = "id",
): Record<string, unknown> {
  return {
    mode: "keyword",
    keyword: keyword.trim(),
    country: country.toLowerCase(),
    sort: "relevancy",
    maxProducts: Math.min(Math.max(Math.round(productLimit), 1), 500),
  };
}

/** xtracto/shopee-shop-scraper — `shop` menerima URL, username, atau shop id. */
export function buildShopeeShopInput(shopUrl: string): Record<string, unknown> {
  const shop = shopUrl.includes("shopee.") ? cleanShopeeUrl(shopUrl.trim()) : shopUrl.trim();
  return {
    shop,
    country: shopeeCountryFromUrl(shop).toLowerCase(),
    maxProducts: SHOPEE_SHOP_PRODUCT_LIMIT,
  };
}

/** xtracto/shopee-scraper mode `url` — negara dideteksi otomatis dari domain. */
export function buildShopeeProductInput(productUrl: string): Record<string, unknown> {
  const url = cleanShopeeUrl(productUrl.trim());
  return {
    mode: "url",
    url,
    country: shopeeCountryFromUrl(url).toLowerCase(),
    maxProducts: 1,
    fetchDetail: true,
  };
}

/**
 * dami_studio/shopee-shop-reviews-scraper. URL produk → actor menyaring review
 * produk itu dari sapuan review toko (Shopee tidak punya feed per produk).
 */
export function buildShopeeReviewsInput(productUrl: string): Record<string, unknown> {
  return {
    startUrls: [cleanShopeeUrl(productUrl.trim())],
    maxReviewsPerShop: SHOPEE_REVIEW_LIMIT,
    onlyWithText: true,
    includeShopSummary: false,
  };
}

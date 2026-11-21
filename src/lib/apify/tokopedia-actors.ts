import "server-only";

/**
 * Actor Apify untuk Tokopedia. Satu actor all-in-one melayani keempat kebutuhan;
 * yang membedakan hanya bentuk input.
 *
 * | Kebutuhan          | Env                             | Default                  |
 * |--------------------|---------------------------------|--------------------------|
 * | Cari per keyword   | APIFY_ACTOR_TOKOPEDIA_SEARCH    | memo23~tokopedia-scraper |
 * | Produk satu toko   | APIFY_ACTOR_TOKOPEDIA_SHOP      | memo23~tokopedia-scraper |
 * | Detail satu produk | APIFY_ACTOR_TOKOPEDIA_PRODUCT   | memo23~tokopedia-scraper |
 * | Review produk      | APIFY_ACTOR_TOKOPEDIA_REVIEWS   | memo23~tokopedia-scraper |
 *
 * Input builder di bawah ditulis untuk skema memo23. Mengganti actor lewat env
 * hanya aman bila actor pengganti menerima input yang sama.
 */
const TOKOPEDIA_DEFAULT_ACTOR = "memo23~tokopedia-scraper";

export const TOKOPEDIA_ACTOR_DEFAULTS = {
  search: TOKOPEDIA_DEFAULT_ACTOR,
  shop: TOKOPEDIA_DEFAULT_ACTOR,
  product: TOKOPEDIA_DEFAULT_ACTOR,
  reviews: TOKOPEDIA_DEFAULT_ACTOR,
} as const;

export const TOKOPEDIA_REVIEW_LIMIT = 500;
export const TOKOPEDIA_SHOP_PRODUCT_LIMIT = 100;

function readEnv(key: string): string | null {
  return process.env[key]?.trim() || null;
}

export function getTokopediaSearchActorId(): string {
  return readEnv("APIFY_ACTOR_TOKOPEDIA_SEARCH") ?? TOKOPEDIA_ACTOR_DEFAULTS.search;
}

export function getTokopediaShopActorId(): string {
  return readEnv("APIFY_ACTOR_TOKOPEDIA_SHOP") ?? TOKOPEDIA_ACTOR_DEFAULTS.shop;
}

export function getTokopediaProductActorId(): string {
  return readEnv("APIFY_ACTOR_TOKOPEDIA_PRODUCT") ?? TOKOPEDIA_ACTOR_DEFAULTS.product;
}

export function getTokopediaReviewsActorId(): string {
  return readEnv("APIFY_ACTOR_TOKOPEDIA_REVIEWS") ?? TOKOPEDIA_ACTOR_DEFAULTS.reviews;
}

function parseTokopediaUrl(rawUrl: string, label: string): URL {
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error(`URL ${label} Tokopedia tidak valid.`);
  }
  if (!parsed.hostname.toLowerCase().includes("tokopedia.com")) {
    throw new Error("URL harus dari tokopedia.com.");
  }
  parsed.protocol = "https:";
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}

/** URL toko kanonik: `https://www.tokopedia.com/<toko>` tanpa tab, query, atau hash. */
export function normalizeTokopediaShopUrl(rawUrl: string): string {
  const parsed = parseTokopediaUrl(rawUrl, "toko");
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length >= 2) {
    parsed.pathname = `/${segments[0]}`;
  }
  return parsed.toString().replace(/\/$/, "");
}

/** URL produk tanpa parameter pelacakan (`extParam`, dll.). */
export function cleanTokopediaProductUrl(rawUrl: string): string {
  return parseTokopediaUrl(rawUrl, "produk").toString().replace(/\/$/, "");
}

/** Pencarian keyword — satu baris per produk. */
export function buildTokopediaSearchInput(
  keyword: string,
  productLimit: number,
): Record<string, unknown> {
  return {
    keywords: [keyword.trim()],
    maxItems: Math.min(Math.max(Math.round(productLimit), 1), 500),
  };
}

/** Produk satu toko — URL toko sebagai start URL. */
export function buildTokopediaShopInput(shopUrl: string): Record<string, unknown> {
  return {
    startUrls: [normalizeTokopediaShopUrl(shopUrl)],
    maxItems: TOKOPEDIA_SHOP_PRODUCT_LIMIT,
  };
}

/** Detail satu produk — `scrapeDetails` mengisi stok, sold persis, spesifikasi. */
export function buildTokopediaProductInput(
  productUrl: string,
): Record<string, unknown> {
  return {
    startUrls: [cleanTokopediaProductUrl(productUrl)],
    scrapeDetails: true,
    maxItems: 1,
  };
}

/** Review satu produk — `outputMode: "reviews"` memberi satu baris per review. */
export function buildTokopediaReviewsInput(
  productUrl: string,
): Record<string, unknown> {
  return {
    outputMode: "reviews",
    startUrls: [cleanTokopediaProductUrl(productUrl)],
    reviewSort: "newest",
    maxReviewsPerProduct: TOKOPEDIA_REVIEW_LIMIT,
    maxItems: TOKOPEDIA_REVIEW_LIMIT,
  };
}

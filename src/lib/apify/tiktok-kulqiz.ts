import "server-only";

import type { NormalizedShopProduct } from "@/lib/apify/normalize";

/** Kategori beauty TikTok Shop Indonesia (kulqiz tidak punya keyword search). */
export const KULQIZ_BEAUTY_CATEGORY_URL =
  "https://shop-id.tokopedia.com/c/beauty-personal-care/601450";

/** Produk yang sering muncul saat crawl kategori luas — buang jika keyword tidak relevan. */
const NOISE_PATTERNS: RegExp[] = [
  /\bpopok\b/i,
  /\bdiapers?\b/i,
  /\bpampers\b/i,
  /\bsilver pants\b/i,
  /\beyelash\b/i,
  /\bbulu mata\b/i,
  /\bcushion\b/i,
  /\blipstik\b/i,
  /\blipstick\b/i,
  /\blip cream\b/i,
  /\bbedak\b/i,
  /\bfoundation\b/i,
  /\bparfum\b/i,
  /\bperfume\b/i,
  /\bsabun cuci muka\b/i,
  /\bface wash\b/i,
  /\bhandphone\b/i,
  /\bcase hp\b/i,
];

const TOKEN_VARIANTS: Record<string, string[]> = {
  body: ["body", "tubuh", "badan"],
  lotion: ["lotion", "losion", "body milk", "body butter"],
  serum: ["serum"],
  cream: ["cream", "krim", "creme"],
  moisturizer: ["moisturizer", "moisturiser", "pelembap"],
  sunscreen: ["sunscreen", "sunblock", "tabir surya"],
  scrub: ["scrub", "lulur"],
  soap: ["soap", "sabun"],
};

export function isKulqizTikTokShopActor(actorId: string | null): boolean {
  if (!actorId) return false;
  const n = actorId.replace(/\//g, "~").toLowerCase();
  return (
    (n.includes("kulqiz") && n.includes("tiktok-shop-scraper")) ||
    n === "kulqiz~tiktok-shop-scraper"
  );
}

/**
 * Product Discovery — batasi fetch Apify agar tidak 200+ baris.
 * Pass 1: kategori saja (~20–40 produk). Pass 2 (expand): subkategori, tetap capped.
 */
export function buildKulqizDiscoveryInput(
  productLimit: number,
  expandSubcategories = false,
): Record<string, unknown> {
  const limit = Math.min(Math.max(productLimit, 1), 100);
  const fetchCap = expandSubcategories
    ? Math.min(limit * 3, 60)
    : Math.min(limit + 15, 40);

  return {
    crawlCategories: false,
    startUrl: KULQIZ_BEAUTY_CATEGORY_URL,
    crawlSubcategories: expandSubcategories,
    maxProducts: fetchCap,
  };
}

export function buildKulqizShopInput(shopUrl: string): Record<string, unknown> {
  const url = shopUrl.trim();
  if (url.includes("/c/")) {
    return {
      crawlCategories: false,
      startUrl: url,
      crawlSubcategories: false,
      maxProducts: 60,
    };
  }
  if (url.includes("/pdp/")) {
    return {
      productUrls: [url],
      includeReviews: false,
    };
  }
  return {
    crawlCategories: false,
    startUrl: KULQIZ_BEAUTY_CATEGORY_URL,
    crawlSubcategories: false,
    maxProducts: 80,
  };
}

export function buildKulqizReviewInput(
  productUrl: string,
): Record<string, unknown> {
  return {
    productUrls: [productUrl.trim()],
    includeReviews: true,
    maxReviews: 20,
  };
}

function tokenVariants(token: string): string[] {
  return TOKEN_VARIANTS[token] ?? [token];
}

function isNoiseProduct(name: string, keyword: string): boolean {
  const hay = name.toLowerCase();
  const kw = keyword.toLowerCase();
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(hay) && !pattern.test(kw)) return true;
  }
  return false;
}

function productMatchesKeyword(name: string, keyword: string): boolean {
  const hay = name.toLowerCase();
  const tokens = keyword
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return true;

  return tokens.every((token) => {
    const variants = tokenVariants(token);
    return variants.some((v) => hay.includes(v));
  });
}

function relevanceScore(name: string, keyword: string): number {
  const hay = name.toLowerCase();
  const tokens = keyword
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  let score = 0;
  for (const token of tokens) {
    for (const variant of tokenVariants(token)) {
      if (hay.includes(variant)) score += variant.includes(" ") ? 3 : 1;
    }
  }
  if (hay.includes(keyword.trim().toLowerCase())) score += 5;
  return score;
}

export function filterShopProductsByKeyword(
  products: NormalizedShopProduct[],
  keyword: string,
): NormalizedShopProduct[] {
  const kw = keyword.trim();
  if (!kw) return products;

  return products
    .filter((p) => !isNoiseProduct(p.name, kw))
    .filter((p) => productMatchesKeyword(p.name, kw))
    .sort(
      (a, b) =>
        relevanceScore(b.name, kw) - relevanceScore(a.name, kw) ||
        (b.soldCount ?? 0) - (a.soldCount ?? 0),
    );
}

function shopSlugTokensFromUrl(shopUrl: string): string[] {
  try {
    const path = new URL(shopUrl).pathname.toLowerCase();
    const storeMatch = path.match(/\/store\/([^/]+)/);
    if (storeMatch?.[1]) {
      return storeMatch[1].split("-").filter((p) => p.length >= 3);
    }
  } catch {
    /* ignore */
  }
  return [];
}

/** Competitor: filter produk by nama toko dari slug URL `/store/...`. */
export function filterShopProductsByShopUrl(
  products: NormalizedShopProduct[],
  shopUrl: string,
): NormalizedShopProduct[] {
  const tokens = shopSlugTokensFromUrl(shopUrl);
  if (tokens.length === 0) return products;
  return products.filter((p) => {
    const shop = (p.shopName ?? "").toLowerCase();
    if (!shop) return false;
    return tokens.some((t) => shop.includes(t));
  });
}

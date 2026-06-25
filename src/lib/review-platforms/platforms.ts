/** Client-safe metadata for review source platforms (no server-only imports). */

export type ReviewPlatformCategory = "marketplace" | "community" | "import";

export type ReviewPlatformMeta = {
  key: string;
  label: string;
  category: ReviewPlatformCategory;
  urlPlaceholder: string;
  /** Regex pattern strings — validated on server via `new RegExp(source)`. */
  urlPatternSources: string[];
  actorEnvKey: string;
  actorEnvHint: string;
};

export const REVIEW_PLATFORMS: ReviewPlatformMeta[] = [
  {
    key: "shopee",
    label: "Shopee",
    category: "marketplace",
    urlPlaceholder: "https://shopee.co.id/product/...",
    urlPatternSources: ["shopee\\."],
    actorEnvKey: "APIFY_ACTOR_SHOPEE_REVIEWS",
    actorEnvHint:
      "Scrape Shopee via VPS (SCRAPER_API_URL) — fallback Apify jika VPS gagal.",
  },
  {
    key: "tokopedia",
    label: "Tokopedia",
    category: "marketplace",
    urlPlaceholder: "https://www.tokopedia.com/...",
    urlPatternSources: ["tokopedia\\.com"],
    actorEnvKey: "APIFY_ACTOR_TOKOPEDIA_REVIEWS",
    actorEnvHint: "Set APIFY_ACTOR_TOKOPEDIA_REVIEWS.",
  },
  {
    key: "lazada",
    label: "Lazada",
    category: "marketplace",
    urlPlaceholder: "https://www.lazada.co.id/products/...",
    urlPatternSources: ["lazada\\."],
    actorEnvKey: "APIFY_ACTOR_LAZADA_REVIEWS",
    actorEnvHint: "Scrape Lazada via VPS (SCRAPER_API_URL).",
  },
  {
    key: "tiktok_shop",
    label: "TikTok Shop",
    category: "marketplace",
    urlPlaceholder: "https://www.tiktok.com/shop/...",
    urlPatternSources: ["tiktok\\.com"],
    actorEnvKey: "APIFY_ACTOR_TIKTOK_REVIEWS",
    actorEnvHint: "Set APIFY_ACTOR_TIKTOK_REVIEWS (mis. kulqiz~tiktok-shop-scraper).",
  },
  {
    key: "femaledaily",
    label: "Female Daily",
    category: "community",
    urlPlaceholder: "https://reviews.femaledaily.com/products/.../brand/slug",
    urlPatternSources: ["femaledaily\\.com"],
    actorEnvKey: "APIFY_ACTOR_REVIEW_FEMALEDAILY",
    actorEnvHint:
      "Scrape Female Daily via VPS — paste URL dari reviews.femaledaily.com (SCRAPER_API_URL).",
  },
  {
    key: "sociolla",
    label: "Sociolla",
    category: "community",
    urlPlaceholder: "https://www.sociolla.com/body-serum/94687-nama-produk.html",
    urlPatternSources: ["sociolla\\.com"],
    actorEnvKey: "APIFY_ACTOR_REVIEW_SOCIOLLA",
    actorEnvHint:
      "Scrape Sociolla via VPS — paste URL halaman produk dari www.sociolla.com (SCRAPER_API_URL).",
  },
  {
    key: "csv",
    label: "Import CSV",
    category: "import",
    urlPlaceholder: "https://example.com/manual-import (opsional)",
    urlPatternSources: [],
    actorEnvKey: "",
    actorEnvHint: "Upload file CSV — tidak memerlukan Apify.",
  },
];

export function getReviewPlatformMeta(key: string): ReviewPlatformMeta | undefined {
  return REVIEW_PLATFORMS.find((p) => p.key === key);
}

export function getReviewPlatformLabel(key: string): string {
  return getReviewPlatformMeta(key)?.label ?? key;
}

export function reviewPlatformsByCategory(category: ReviewPlatformCategory): ReviewPlatformMeta[] {
  return REVIEW_PLATFORMS.filter((p) => p.category === category);
}

export function isReviewPlatformKey(key: string): boolean {
  return REVIEW_PLATFORMS.some((p) => p.key === key);
}

export function marketplaceFromPlatformKey(
  key: string,
): "SHOPEE" | "TOKOPEDIA" | "LAZADA" | "TIKTOK_SHOP" | "FEMALEDAILY" | "SOCIOLLA" | null {
  switch (key) {
    case "shopee":
      return "SHOPEE";
    case "tokopedia":
      return "TOKOPEDIA";
    case "lazada":
      return "LAZADA";
    case "tiktok_shop":
      return "TIKTOK_SHOP";
    case "femaledaily":
      return "FEMALEDAILY";
    case "sociolla":
      return "SOCIOLLA";
    default:
      return null;
  }
}

export function platformKeyFromMarketplace(
  marketplace:
    | "SHOPEE"
    | "TOKOPEDIA"
    | "LAZADA"
    | "TIKTOK_SHOP"
    | "FEMALEDAILY"
    | "SOCIOLLA",
): string {
  switch (marketplace) {
    case "SHOPEE":
      return "shopee";
    case "TOKOPEDIA":
      return "tokopedia";
    case "LAZADA":
      return "lazada";
    case "TIKTOK_SHOP":
      return "tiktok_shop";
    case "FEMALEDAILY":
      return "femaledaily";
    case "SOCIOLLA":
      return "sociolla";
  }
}

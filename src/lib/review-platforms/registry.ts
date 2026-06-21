import "server-only";

import { ResearchMarketplace } from "@prisma/client";
import { cleanShopeeUrl } from "@/lib/apify/shopee-url";
import {
  buildKulqizReviewInput,
  isKulqizTikTokShopActor,
} from "@/lib/apify/tiktok-kulqiz";
import {
  getReviewPlatformMeta,
  marketplaceFromPlatformKey,
  REVIEW_PLATFORMS,
  getReviewPlatformLabel,
  type ReviewPlatformMeta,
} from "@/lib/review-platforms/platforms";
import { isScraperApiConfigured } from "@/lib/scraper-api/client";

const GIO21_SHOPEE_PRODUCT_DETAIL = "gio21~shopee-product-detail";

function normalizeActorId(actorId: string | null): string {
  return (actorId ?? "").replace(/\//g, "~").toLowerCase();
}

function isGio21ProductDetailActor(actorId: string | null): boolean {
  if (!actorId) return false;
  const n = normalizeActorId(actorId);
  return n.includes("shopee-product-detail") || n === GIO21_SHOPEE_PRODUCT_DETAIL;
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

function readActorEnv(envKey: string): string | null {
  if (!envKey) return null;
  const value = process.env[envKey]?.trim();
  return value || null;
}

function jsonLdActorId(): string | null {
  return readActorEnv("APIFY_ACTOR_REVIEW_JSONLD");
}

export function getReviewActorIdForPlatform(platformKey: string): string | null {
  const meta = getReviewPlatformMeta(platformKey);
  if (!meta || meta.category === "import") return null;

  const dedicated = readActorEnv(meta.actorEnvKey);
  if (dedicated) return dedicated;

  if (meta.category === "community") {
    return jsonLdActorId();
  }

  return null;
}

export function isReviewPlatformConfigured(platformKey: string): boolean {
  if (platformKey === "csv") return true;
  if (platformKey === "femaledaily" || platformKey === "sociolla") return true;
  if (platformKey === "tokopedia" && isScraperApiConfigured()) return true;
  return !!getReviewActorIdForPlatform(platformKey);
}

export function reviewPlatformEnvHint(platformKey: string): string {
  const meta = getReviewPlatformMeta(platformKey);
  if (!meta) return `Platform tidak dikenal: ${platformKey}`;
  if (meta.category === "import") return meta.actorEnvHint;

  const dedicated = readActorEnv(meta.actorEnvKey);
  if (dedicated) return meta.actorEnvHint;

  if (platformKey === "femaledaily") {
    return "Scrape native Female Daily (reviews.femaledaily.com) — tidak perlu Apify.";
  }

  if (platformKey === "sociolla") {
    return "Scrape native Sociolla (bj-public-api.sociolla.com) — tidak perlu Apify.";
  }

  if (platformKey === "tokopedia" && isScraperApiConfigured()) {
    return "Scrape Tokopedia via VPS (SCRAPER_API_URL + SCRAPER_API_KEY).";
  }

  if (meta.category === "community" && jsonLdActorId()) {
    return `${meta.actorEnvHint} Fallback JSON-LD: APIFY_ACTOR_REVIEW_JSONLD aktif.`;
  }

  return meta.actorEnvHint;
}

export function buildReviewActorInputForPlatform(
  platformKey: string,
  productUrl: string,
): Record<string, unknown> {
  const actorId = getReviewActorIdForPlatform(platformKey);
  const url = productUrl.trim();

  switch (platformKey) {
    case "shopee":
      if (isGio21ProductDetailActor(actorId)) {
        const cleaned = cleanShopeeUrl(url);
        return {
          productUrls: [cleaned],
          country: shopeeCountryFromUrl(cleaned),
          includeReviews: true,
          reviewsLimit: 500,
        };
      }
      return { productUrls: [url], maxReviews: 500 };
    case "tokopedia":
      return {
        product_url: url,
        results_wanted: 500,
        max_pages: 50,
      };
    case "tiktok_shop":
      if (isKulqizTikTokShopActor(actorId)) {
        return buildKulqizReviewInput(url);
      }
      return { url, maxReviews: 500 };
    case "femaledaily":
    case "sociolla":
      if (jsonLdActorId() && actorId === jsonLdActorId()) {
        return { urls: [url], maxReviews: 500 };
      }
      return {
        productUrl: url,
        productUrls: [url],
        url,
        maxReviews: 500,
        reviewsLimit: 500,
      };
    default:
      return { url, maxReviews: 500 };
  }
}

export function validateReviewPlatformUrl(
  platformKey: string,
  productUrl: string,
): string | null {
  const meta = getReviewPlatformMeta(platformKey);
  if (!meta) return "Platform tidak dikenal.";
  if (meta.category === "import") return null;

  let parsed: URL;
  try {
    parsed = new URL(productUrl);
  } catch {
    return "URL tidak valid.";
  }

  if (meta.urlPatternSources.length === 0) return null;

  const hostAndPath = `${parsed.hostname}${parsed.pathname}`;
  const ok = meta.urlPatternSources.some((src) => new RegExp(src, "i").test(hostAndPath));
  if (!ok) {
    return `URL harus dari ${meta.label} (contoh: ${meta.urlPlaceholder}).`;
  }
  return null;
}

export function resolveReviewSourcePlatformKey(input: {
  platformKey?: string;
  marketplace?: ResearchMarketplace | null;
}): string {
  if (input.platformKey && getReviewPlatformMeta(input.platformKey)) {
    return input.platformKey;
  }
  if (input.marketplace) {
    return marketplaceFromPlatformKey(input.marketplace) ?? "shopee";
  }
  return "shopee";
}

export function marketplaceForPlatformKey(
  platformKey: string,
): ResearchMarketplace | null {
  const mp = marketplaceFromPlatformKey(platformKey);
  return mp as ResearchMarketplace | null;
}

export function emptyReviewScrapeFailureMessage(
  platformKey: string,
  opts: { hasMock?: boolean; actorError?: string | null },
): string {
  if (opts.hasMock) {
    return "Apify mengembalikan data MOCK — upgrade ke plan berbayar Apify untuk data live.";
  }
  if (opts.actorError) return opts.actorError;

  const meta = getReviewPlatformMeta(platformKey);
  const label = meta?.label ?? platformKey;
  return `Tidak ada review ditemukan dari scraper. Pastikan URL produk ${label} valid.`;
}

export function isAnyReviewScrapeConfigured(): boolean {
  return REVIEW_PLATFORMS.some(
    (p) => p.category !== "import" && isReviewPlatformConfigured(p.key),
  );
}

export function configuredReviewPlatformLabels(): string[] {
  return REVIEW_PLATFORMS.filter(
    (p) => p.category !== "import" && isReviewPlatformConfigured(p.key),
  ).map((p) => getReviewPlatformLabel(p.key));
}

export type { ReviewPlatformMeta };

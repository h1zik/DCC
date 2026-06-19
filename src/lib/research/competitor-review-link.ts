import "server-only";

import type { ResearchMarketplace, ReviewIntelSourceStatus } from "@prisma/client";
import { cleanShopeeUrl } from "@/lib/apify/shopee-url";
import { platformKeyFromMarketplace } from "@/lib/review-platforms/platforms";

export function normalizeCompetitorSkuProductUrl(
  marketplace: ResearchMarketplace,
  url: string,
): string {
  const trimmed = url.trim();
  const platformKey = platformKeyFromMarketplace(marketplace);
  if (platformKey === "shopee") return cleanShopeeUrl(trimmed);
  try {
    const u = new URL(trimmed);
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return trimmed;
  }
}

export function skuProductUrlCandidates(
  marketplace: ResearchMarketplace,
  url: string,
): string[] {
  const trimmed = url.trim();
  const normalized = normalizeCompetitorSkuProductUrl(marketplace, url);
  return [...new Set([normalized, trimmed])];
}

export type SkuReviewIntelLink = {
  sourceId: string;
  status: ReviewIntelSourceStatus;
};

export function pickReviewIntelLinkForSku(
  marketplace: ResearchMarketplace,
  productUrl: string,
  byUrl: Map<string, SkuReviewIntelLink>,
): SkuReviewIntelLink | null {
  for (const candidate of skuProductUrlCandidates(marketplace, productUrl)) {
    const hit = byUrl.get(candidate);
    if (hit) return hit;
  }
  return null;
}

export function buildReviewIntelLinkByUrl(
  rows: { id: string; productUrl: string; status: ReviewIntelSourceStatus }[],
): Map<string, SkuReviewIntelLink> {
  const map = new Map<string, SkuReviewIntelLink>();
  for (const row of rows) {
    const link = { sourceId: row.id, status: row.status };
    map.set(row.productUrl.trim(), link);
  }
  return map;
}

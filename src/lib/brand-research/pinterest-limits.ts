import "server-only";

import { getPinterestMaxPinsPerKeyword } from "@/lib/apify/actors";
import { isApifyConfigured } from "@/lib/apify/client";
import { isVpsPinterestConfigured } from "@/lib/scraper-api/pinterest-pins";

export const PINTEREST_PINS_MIN = 10;
export const PINTEREST_PINS_MAX = 200;

export function clampPinterestMaxPins(value: number): number {
  if (!Number.isFinite(value)) return getPinterestMaxPinsPerKeyword();
  return Math.min(
    Math.max(Math.round(value), PINTEREST_PINS_MIN),
    PINTEREST_PINS_MAX,
  );
}

export function resolvePinterestMaxPinsPerKeyword(collection?: {
  maxPinsPerKeyword?: number | null;
}): number {
  if (collection?.maxPinsPerKeyword != null) {
    return clampPinterestMaxPins(collection.maxPinsPerKeyword);
  }
  return getPinterestMaxPinsPerKeyword();
}

/** Pinterest scrape tersedia via VPS (prioritas) atau Apify (fallback). */
export function isPinterestScrapeConfigured(): boolean {
  return isVpsPinterestConfigured() || isApifyConfigured();
}

import "server-only";

import type { NormalizedShopProduct } from "@/lib/apify/normalize";
import {
  parseCompactCount,
  primarySoldCount,
} from "@/lib/research/shop-product-metrics";

function pickString(item: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickNumber(item: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function pickBool(item: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "boolean") return value;
  }
  return false;
}

function pickNumericOrCompact(
  item: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
    if (typeof value === "string") {
      const compact = parseCompactCount(value);
      if (compact != null) return compact;
      const parsed = Number(value.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(parsed)) return Math.round(parsed);
    }
  }
  return null;
}

/** Shopee search nests listing fields under item_basic. */
function pickNestedMetrics(
  item: Record<string, unknown>,
  keys: string[],
): number | null {
  const direct = pickNumericOrCompact(item, keys);
  if (direct != null) return direct;
  for (const nestedKey of ["item_basic", "itemBasic", "item"]) {
    const nested = item[nestedKey];
    if (nested && typeof nested === "object") {
      const v = pickNumericOrCompact(nested as Record<string, unknown>, keys);
      if (v != null) return v;
    }
  }
  return null;
}

/**
 * Parse Shopee sold-display strings into a count.
 *
 * The Brightdata Browser Scraper returns sold counts only as a localized display
 * string (`sold_display: "1RB+ terjual"`) — the numeric `sold`/`historical_sold`
 * fields are now null. parseCompactCount alone mis-reads "1RB+ terjual" as 1 because
 * of the trailing word, so strip the unit words first ("terjual", "sold", "per bulan").
 */
export function parseSoldDisplay(item: Record<string, unknown>): number | null {
  const raw = pickString(item, [
    "sold_display",
    "soldDisplay",
    "historical_sold_display",
    "sold_count_display",
  ]);
  if (!raw) return null;
  const token = raw
    .toLowerCase()
    .replace(/terjual|sold|per\s*bulan|\/?\s*bln|\/?\s*bulan/g, "")
    .trim();
  return parseCompactCount(token);
}

/** Shopee returns rating_count as star histogram array; first element = total reviews. */
export function pickMarketplaceReviewCount(item: Record<string, unknown>): number {
  const raw = item.rating_count ?? item.ratingCount ?? item.review_count ?? item.reviewCount;
  if (Array.isArray(raw)) {
    const nums = raw.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (nums.length === 0) return 0;
    if (nums.length >= 6) return nums[0]!;
    return nums.reduce((sum, n) => sum + n, 0);
  }
  return pickNumber(item, ["rating_count", "reviewCount", "review_count", "reviews"]) ?? 0;
}

/** Extract VPS marketplace sales metrics from raw scraper item. */
export function extractVpsProductMetrics(
  item: Record<string, unknown>,
): Pick<
  NormalizedShopProduct,
  | "exactSold"
  | "historicalSold"
  | "monthlySold"
  | "estimatedRevenue"
  | "stock"
  | "shopLocation"
  | "isOfficialShop"
  | "soldCount"
> {
  const historicalSold = pickNestedMetrics(item, [
    "historical_sold",
    "historicalSold",
    "historicalSoldEstimated",
  ]);
  const listingSold = pickNestedMetrics(item, [
    "sold",
    "soldCount",
    "sold_count",
    "exact_sold",
    "exactSold",
  ]);
  const monthlySold = pickNestedMetrics(item, ["monthly_sold", "monthlySold"]);
  // Browser Scraper only exposes sold as a display string ("1RB+ terjual"); use it as
  // a (lower-bound) lifetime fallback when the numeric fields are absent.
  const displaySold = parseSoldDisplay(item);

  // VPS sample: historical_sold = total lifetime; monthly_sold = bulan ini; sold = listing badge.
  const exactSold = listingSold;
  const lifetimeSold = historicalSold ?? displaySold;

  const price = pickNumber(item, ["price", "price_before_discount"]);
  let estimatedRevenue = pickNumber(item, [
    "estimated_revenue",
    "estimatedRevenue",
  ]);
  if (
    estimatedRevenue == null &&
    price != null &&
    lifetimeSold != null &&
    lifetimeSold > 0
  ) {
    estimatedRevenue = price * lifetimeSold;
  }

  const stock = pickNestedMetrics(item, ["stock", "stock_count", "stockCount"]);
  const shopLocation = pickString(item, ["shop_location", "shopLocation"]);
  const isOfficialShop = pickBool(item, ["is_official_shop", "isOfficialShop"]);

  const soldCount = primarySoldCount({
    exactSold,
    historicalSold: lifetimeSold,
    monthlySold,
  });

  return {
    exactSold,
    historicalSold: lifetimeSold,
    monthlySold,
    estimatedRevenue,
    stock,
    shopLocation,
    isOfficialShop,
    soldCount,
  };
}

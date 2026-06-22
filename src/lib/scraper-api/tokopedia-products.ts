import "server-only";

import type { NormalizedShopProduct } from "@/lib/apify/normalize";
import { extractVpsProductMetrics, pickMarketplaceReviewCount } from "@/lib/scraper-api/product-metrics";
import {
  loadAllVpsRunItems,
  startVpsActorRun,
} from "@/lib/scraper-api/client";

const MAX_PER_PAGE = 120;

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

function pickExternalId(item: Record<string, unknown>, index: number): string {
  for (const key of ["item_id", "itemId", "id", "product_id", "productId"]) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return `tkp-${index}`;
}

/** Map langsung dari format VPS Tokopedia → NormalizedShopProduct. */
export function normalizeVpsTokopediaProducts(
  items: Record<string, unknown>[],
): NormalizedShopProduct[] {
  const out: NormalizedShopProduct[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const name =
      pickString(item, ["title", "name", "product_name", "productName"]) ?? "";
    const productUrl =
      pickString(item, ["product_url", "productUrl", "url", "link"]) ?? "";
    if (!name || !productUrl) continue;

    const discount = pickNumber(item, ["discount", "discountPercent"]);
    const promoText =
      discount != null && discount > 0 ? `Diskon ${Math.round(discount)}%` : null;

    const metrics = extractVpsProductMetrics(item);

    out.push({
      externalId: pickExternalId(item, i),
      name,
      productUrl,
      imageUrl:
        pickString(item, ["image_url", "imageUrl", "image", "thumbnail"]) ??
        null,
      price: pickNumber(item, ["price", "price_before_discount"]),
      rating: pickNumber(item, ["rating_star", "rating", "stars", "score"]),
      reviewCount: pickMarketplaceReviewCount(item),
      hasPromo: discount != null && discount > 0,
      promoText,
      categoryRank: pickNumber(item, ["rank", "categoryRank", "page"]),
      shopName:
        pickString(item, ["shop_name", "shopName", "seller_name", "seller"]) ??
        null,
      soldCount: metrics.soldCount,
      exactSold: metrics.exactSold,
      historicalSold: metrics.historicalSold,
      monthlySold: metrics.monthlySold,
      estimatedRevenue: metrics.estimatedRevenue,
      stock: metrics.stock,
      shopLocation: metrics.shopLocation,
      isOfficialShop: metrics.isOfficialShop,
    });
  }

  return out;
}

async function readVpsRunItems(
  run: Awaited<ReturnType<typeof startVpsActorRun>>,
): Promise<Record<string, unknown>[]> {
  return loadAllVpsRunItems(run);
}

async function fetchTokopediaProductsViaVps(
  actorId: "tokopedia-search" | "tokopedia-shop",
  baseInput: Record<string, unknown>,
  maxItems: number,
  opts?: { includeExactSold?: boolean },
): Promise<Record<string, unknown>[]> {
  const target = Math.min(Math.max(maxItems, 1), 500);
  const collected: Record<string, unknown>[] = [];
  let page = 1;

  while (collected.length < target) {
    const limit = Math.min(target - collected.length, MAX_PER_PAGE);
    const run = await startVpsActorRun(
      actorId,
      {
        ...baseInput,
        page,
        limit,
        download_images: false,
        include_all_images: false,
        ...(opts?.includeExactSold ? { include_exact_sold: true } : {}),
      },
      { wait: true, timeout: 900 },
    );

    const batch = await readVpsRunItems(run);
    if (batch.length === 0) break;

    collected.push(...batch);
    if (batch.length < limit) break;
    page += 1;
  }

  return collected.slice(0, target);
}

/** Normalisasi URL toko Tokopedia ke format yang VPS pahami. */
export function normalizeTokopediaShopUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("URL toko Tokopedia tidak valid.");
  }

  if (!parsed.hostname.toLowerCase().includes("tokopedia.com")) {
    throw new Error("URL harus dari tokopedia.com.");
  }

  parsed.protocol = "https:";
  parsed.search = "";
  parsed.hash = "";

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length >= 2) {
    parsed.pathname = `/${segments[0]}`;
  }

  return parsed.toString().replace(/\/$/, "");
}

/** Actor `tokopedia-search` di VPS — product discovery by keyword. */
export async function fetchTokopediaSearchViaVps(
  keyword: string,
  maxItems: number,
): Promise<NormalizedShopProduct[]> {
  const items = await fetchTokopediaProductsViaVps(
    "tokopedia-search",
    { keyword: keyword.trim() },
    maxItems,
    { includeExactSold: true },
  );
  return normalizeVpsTokopediaProducts(items);
}

/** Actor `tokopedia-shop` di VPS — competitor tracker by shop URL. */
export async function fetchTokopediaShopViaVps(
  shopUrl: string,
  maxItems = 100,
): Promise<NormalizedShopProduct[]> {
  const normalizedShopUrl = normalizeTokopediaShopUrl(shopUrl);
  const items = await fetchTokopediaProductsViaVps(
    "tokopedia-shop",
    { shop_url: normalizedShopUrl },
    maxItems,
  );
  return normalizeVpsTokopediaProducts(items);
}

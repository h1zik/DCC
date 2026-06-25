import "server-only";

import type { NormalizedShopProduct } from "@/lib/apify/normalize";
import {
  extractVpsProductMetrics,
  pickMarketplaceReviewCount,
} from "@/lib/scraper-api/product-metrics";
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
  for (const key of ["item_id", "itemId", "id", "product_id", "productId", "sku"]) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return `lzd-${index}`;
}

/** Map langsung dari format VPS Lazada → NormalizedShopProduct. */
export function normalizeVpsLazadaProducts(
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
      description: pickString(item, ["description", "desc", "detail"]),
      brand: pickString(item, ["brand", "brand_name", "brandName"]),
      category: pickString(item, ["category", "category_name"]),
      currency: pickString(item, ["currency", "currency_code"]),
    });
  }

  return out;
}

async function readVpsRunItems(
  run: Awaited<ReturnType<typeof startVpsActorRun>>,
): Promise<Record<string, unknown>[]> {
  return loadAllVpsRunItems(run);
}

async function fetchLazadaProductsViaVps(
  actorId: "lazada-search",
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

/** Actor `lazada-search` di VPS — product discovery by keyword. */
export async function fetchLazadaSearchViaVps(
  keyword: string,
  maxItems: number,
): Promise<NormalizedShopProduct[]> {
  const items = await fetchLazadaProductsViaVps(
    "lazada-search",
    { keyword: keyword.trim() },
    maxItems,
    { includeExactSold: true },
  );
  return normalizeVpsLazadaProducts(items);
}

/**
 * Actor `lazada-product` di VPS — detail produk by URL (pasangan `lazada-search` + keyword).
 */
export async function fetchLazadaProductViaVps(
  productUrl: string,
): Promise<NormalizedShopProduct> {
  const normalizedUrl = productUrl.trim();
  const run = await startVpsActorRun(
    "lazada-product",
    {
      product_url: normalizedUrl,
      download_images: false,
    },
    { wait: true, timeout: 900, throwOnFailed: false },
  );

  if (run.status === "failed") {
    throw new Error(run.error ?? "Scrape produk Lazada VPS gagal.");
  }

  const items = await readVpsRunItems(run);
  const products = normalizeVpsLazadaProducts(
    items.map((item) =>
      pickString(item, ["product_url", "productUrl", "url", "link"])
        ? item
        : { ...item, product_url: normalizedUrl },
    ),
  );

  if (products.length === 0) {
    throw new Error("Tidak ada data produk dari VPS Lazada.");
  }

  return products[0]!;
}

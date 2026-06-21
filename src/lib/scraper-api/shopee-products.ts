import "server-only";

import type { NormalizedShopProduct } from "@/lib/apify/normalize";
import { cleanShopeeUrl } from "@/lib/apify/shopee-url";
import {
  fetchVpsRunDataset,
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
  const itemId = pickString(item, ["item_id", "itemId"]) ?? pickNumber(item, ["item_id", "itemId"]);
  const shopId = pickString(item, ["shop_id", "shopId"]) ?? pickNumber(item, ["shop_id", "shopId"]);
  if (itemId != null && shopId != null) {
    return `${shopId}-${itemId}`;
  }
  for (const key of ["id", "product_id", "productId"]) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return `shp-${index}`;
}

/** Map format VPS Shopee ProductItem → NormalizedShopProduct. */
export function normalizeVpsShopeeProducts(
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

    out.push({
      externalId: pickExternalId(item, i),
      name,
      productUrl,
      imageUrl:
        pickString(item, ["image_url", "imageUrl", "image", "thumbnail"]) ??
        null,
      price: pickNumber(item, ["price", "price_before_discount"]),
      rating: pickNumber(item, ["rating_star", "rating", "stars", "score"]),
      reviewCount:
        pickNumber(item, ["rating_count", "reviewCount", "review_count"]) ?? 0,
      hasPromo: discount != null && discount > 0,
      promoText,
      categoryRank: pickNumber(item, ["rank", "categoryRank", "page"]),
      shopName:
        pickString(item, ["shop_name", "shopName", "shop_username", "seller"]) ??
        null,
      soldCount: pickNumber(item, ["sold", "soldCount", "sold_count"]),
    });
  }

  return out;
}

async function readVpsRunItems(
  run: Awaited<ReturnType<typeof startVpsActorRun>>,
): Promise<Record<string, unknown>[]> {
  if (run.items && run.items.length > 0) return run.items;
  if ((run.count ?? 0) > 0 && run.run_id) {
    return fetchVpsRunDataset(run.run_id);
  }
  return [];
}

async function fetchShopeeProductsViaVps(
  actorId: "shopee-search" | "shopee-shop",
  baseInput: Record<string, unknown>,
  maxItems: number,
): Promise<Record<string, unknown>[]> {
  const target = Math.min(Math.max(maxItems, 1), 500);
  const collected: Record<string, unknown>[] = [];
  let page = 0;

  while (collected.length < target) {
    const limit = Math.min(target - collected.length, MAX_PER_PAGE);
    const run = await startVpsActorRun(
      actorId,
      {
        ...baseInput,
        page,
        limit,
        download_images: false,
      },
      { wait: true, timeout: 900, throwOnFailed: false },
    );

    if (run.status === "failed") {
      if (collected.length === 0) {
        throw new Error(run.error ?? "Scrape Shopee VPS gagal.");
      }
      break;
    }

    const batch = await readVpsRunItems(run);
    if (batch.length === 0) break;

    collected.push(...batch);
    if (batch.length < limit) break;
    page += 1;
  }

  return collected.slice(0, target);
}

/** Actor `shopee-search` di VPS — product discovery by keyword. */
export async function fetchShopeeSearchViaVps(
  keyword: string,
  maxItems: number,
): Promise<NormalizedShopProduct[]> {
  const items = await fetchShopeeProductsViaVps(
    "shopee-search",
    { keyword: keyword.trim() },
    maxItems,
  );
  return normalizeVpsShopeeProducts(items);
}

/** Actor `shopee-shop` di VPS — competitor tracker by shop URL. */
export async function fetchShopeeShopViaVps(
  shopUrl: string,
  maxItems = 100,
): Promise<NormalizedShopProduct[]> {
  const normalizedShopUrl = cleanShopeeUrl(shopUrl.trim());
  const items = await fetchShopeeProductsViaVps(
    "shopee-shop",
    { shop_url: normalizedShopUrl },
    maxItems,
  );
  return normalizeVpsShopeeProducts(items);
}

import "server-only";

import type {
  NormalizedShopProduct,
  ProductAttribute,
  ProductModel,
  ProductVariation,
} from "@/lib/apify/normalize";
import { extractVpsProductMetrics, pickMarketplaceReviewCount } from "@/lib/scraper-api/product-metrics";
import { cleanShopeeUrl } from "@/lib/apify/shopee-url";
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

function parseDiscountPercent(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function pickStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}

/** {name, value}[] — spesifikasi produk Shopee (Volume, Negara Asal, dll.). */
function parseAttributes(value: unknown): ProductAttribute[] {
  if (!Array.isArray(value)) return [];
  const out: ProductAttribute[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const name = pickString(obj, ["name", "label", "key"]);
    const val =
      pickString(obj, ["value", "val", "text"]) ??
      (Array.isArray(obj.values) ? pickStringArray(obj.values).join(", ") : null);
    if (name && val) out.push({ name, value: val });
  }
  return out;
}

/** {name, options[]}[] — opsi varian (mis. Ukuran: Single/Twinpack). */
function parseVariations(value: unknown): ProductVariation[] {
  if (!Array.isArray(value)) return [];
  const out: ProductVariation[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const name = pickString(obj, ["name", "label"]);
    const options = pickStringArray(obj.options ?? obj.values);
    if (name && options.length > 0) out.push({ name, options });
  }
  return out;
}

/** SKU konkret dengan harga & stok per varian. */
function parseModels(value: unknown): ProductModel[] {
  if (!Array.isArray(value)) return [];
  const out: ProductModel[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    out.push({
      modelId: pickString(obj, ["model_id", "modelId", "id"]),
      name: pickString(obj, ["name", "model_name", "modelName"]),
      price: pickNumber(obj, ["price"]),
      priceBeforeDiscount: pickNumber(obj, [
        "price_before_discount",
        "priceBeforeDiscount",
      ]),
      stock: pickNumber(obj, ["stock", "stock_count"]),
      sold: pickNumber(obj, ["sold", "sold_count", "soldCount"]),
    });
  }
  return out;
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

    const discount =
      pickNumber(item, ["discount", "discountPercent"]) ??
      parseDiscountPercent(pickString(item, ["discount", "discountPercent"]));
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
        pickString(item, ["shop_name", "shopName", "shop_username", "seller"]) ??
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
      categoryPath: pickStringArray(item.category_path ?? item.categoryPath),
      currency: pickString(item, ["currency", "currency_code"]),
      attributes: parseAttributes(item.attributes),
      variations: parseVariations(item.variations),
      models: parseModels(item.models),
    });
  }

  return out;
}

async function readVpsRunItems(
  run: Awaited<ReturnType<typeof startVpsActorRun>>,
): Promise<Record<string, unknown>[]> {
  return loadAllVpsRunItems(run);
}

async function fetchShopeeProductsViaVps(
  actorId: "shopee-search" | "shopee-shop",
  baseInput: Record<string, unknown>,
  maxItems: number,
  opts?: { includeExactSold?: boolean },
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
        include_exact_sold: opts?.includeExactSold === true,
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

/** Actor `shopee-product` di VPS — detail produk by URL (pasangan `shopee-search` + keyword). */
export async function fetchShopeeProductViaVps(
  productUrl: string,
): Promise<NormalizedShopProduct> {
  const normalizedUrl = cleanShopeeUrl(productUrl.trim());
  const run = await startVpsActorRun(
    "shopee-product",
    {
      product_url: normalizedUrl,
      download_images: false,
    },
    { wait: true, timeout: 900, throwOnFailed: false },
  );

  if (run.status === "failed") {
    throw new Error(run.error ?? "Scrape produk Shopee VPS gagal.");
  }

  const items = await readVpsRunItems(run);
  const products = normalizeVpsShopeeProducts(
    items.map((item) =>
      pickString(item, ["product_url", "productUrl", "url", "link"])
        ? item
        : { ...item, product_url: normalizedUrl },
    ),
  );

  if (products.length === 0) {
    throw new Error("Tidak ada data produk dari VPS Shopee.");
  }

  return products[0]!;
}

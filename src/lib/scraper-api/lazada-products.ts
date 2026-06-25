import "server-only";

import type {
  NormalizedShopProduct,
  ProductAttribute,
} from "@/lib/apify/normalize";
import {
  extractVpsProductMetrics,
  pickMarketplaceReviewCount,
} from "@/lib/scraper-api/product-metrics";
import {
  loadAllVpsRunItems,
  startVpsActorRun,
} from "@/lib/scraper-api/client";
import { primarySoldCount } from "@/lib/research/shop-product-metrics";

const MAX_PER_PAGE = 120;

/** "Rp1.250.000" (titik = ribuan) → 1250000. Hanya ambil digit. */
function parseIdrText(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * sold_text Lazada → integer. Tangani gaya Inggris "1.8K sold" ('.' = desimal)
 * dan gaya Indonesia "1.250 terjual" ('.' = ribuan) / "10rb" / "1,5jt".
 */
function parseLazadaSoldText(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const m = raw.toLowerCase().match(/([\d.,]+)\s*(k|rb|ribu|jt|juta|m)?/i);
  if (!m) return null;
  const suffix = m[2] ?? "";
  // Dengan suffix pengali, angka dasar kecil & pakai 1 pemisah desimal.
  // Tanpa suffix, "."/"," adalah pemisah ribuan → buang semua.
  const base = suffix
    ? parseFloat(m[1]!.replace(",", "."))
    : Number(m[1]!.replace(/[.,]/g, ""));
  if (!Number.isFinite(base)) return null;
  const mult =
    suffix === "k" || suffix === "rb" || suffix === "ribu"
      ? 1_000
      : suffix === "m" || suffix === "jt" || suffix === "juta"
        ? 1_000_000
        : 1;
  return Math.round(base * mult);
}

/** "Rp150.000" — pemisah ribuan gaya Indonesia tanpa ketergantungan ICU. */
function formatIdr(value: number): string {
  return "Rp" + Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** description_html Lazada → teks polos (panel deskripsi render plain text). */
function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Persen diskon Lazada — `discount` bisa "-67%"/67, atau dihitung dari harga normal. */
function pickDiscountPercent(
  item: Record<string, unknown>,
  price: number | null,
  originalPrice: number | null,
): number | null {
  const raw = item.discount ?? item.discountPercent;
  if (typeof raw === "number" && Number.isFinite(raw) && Math.abs(raw) > 0) {
    return Math.round(Math.abs(raw));
  }
  if (typeof raw === "string") {
    const n = Number(raw.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  if (price != null && originalPrice != null && originalPrice > price) {
    return Math.round(((originalPrice - price) / originalPrice) * 100);
  }
  return null;
}

/** "…-i7160450147.html" / "pdp-i5120228372.html" → "7160450147". */
function extractLazadaItemId(url: string): string | null {
  const m = url.match(/-i(\d+)/i) ?? url.match(/\bi(\d+)\.html/i);
  return m ? m[1]! : null;
}

function pickStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((v) => String(v).trim()).filter(Boolean)
    : [];
}

/** rating_distribution Lazada → { "5": n, ... } hanya bintang 1-5 yang valid. */
function parseRatingDistribution(
  value: unknown,
): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const star of ["5", "4", "3", "2", "1"]) {
    const raw = (value as Record<string, unknown>)[star];
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(raw.replace(/[^\d]/g, ""))
          : NaN;
    if (Number.isFinite(n) && n >= 0) out[star] = Math.round(n);
  }
  return Object.keys(out).length > 0 ? out : null;
}

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

    const price = pickNumber(item, ["price", "price_before_discount"]);
    // Detail: `original_price` (number). Search: `original_price_text` ("Rp…").
    const originalPrice =
      pickNumber(item, ["original_price", "originalPrice"]) ??
      parseIdrText(item.original_price_text ?? item.originalPriceText);
    const couponPrice = pickNumber(item, ["coupon_price", "couponPrice"]);
    const discountPercent = pickDiscountPercent(item, price, originalPrice);
    const hasPromo = discountPercent != null && discountPercent > 0;
    const promoText = hasPromo ? `Diskon ${discountPercent}%` : null;

    // description_html adalah enrichment baru; fallback ke field lama bila kosong.
    const descriptionHtml = pickString(item, [
      "description_html",
      "descriptionHtml",
    ]);
    const description = descriptionHtml
      ? stripHtml(descriptionHtml)
      : pickString(item, ["description", "desc", "detail"]);

    const categoryPath = pickStringArray(
      item.category_path ?? item.categoryPath,
    );

    const metrics = extractVpsProductMetrics(item);

    // Enrichment search Lazada: `sold_text` ("1.8K sold") & `location` tidak
    // dikenali extractVpsProductMetrics, jadi isi sebagai fallback di sini.
    const soldFromText = parseLazadaSoldText(item.sold_text ?? item.soldText);
    const exactSold = metrics.exactSold ?? soldFromText;
    const historicalSold = metrics.historicalSold;
    const soldCount =
      metrics.soldCount ??
      primarySoldCount({ historicalSold, exactSold, monthlySold: metrics.monthlySold });
    const shopLocation =
      metrics.shopLocation ?? pickString(item, ["location", "shop_location"]);
    const lifetimeSold = historicalSold ?? exactSold;
    const estimatedRevenue =
      metrics.estimatedRevenue ??
      (price != null && lifetimeSold != null && lifetimeSold > 0
        ? price * lifetimeSold
        : null);

    // Info enrichment yang belum punya kolom sendiri ditampilkan di "Spesifikasi".
    const attributes: ProductAttribute[] = [];
    if (originalPrice != null && price != null && originalPrice > price) {
      attributes.push({ name: "Harga Normal", value: formatIdr(originalPrice) });
    }
    if (hasPromo) {
      attributes.push({ name: "Diskon", value: `${discountPercent}%` });
    }
    if (couponPrice != null && couponPrice > 0) {
      attributes.push({
        name: "Harga Setelah Kupon",
        value: formatIdr(couponPrice),
      });
    }
    const sku = pickString(item, ["sku_id", "skuId", "sku"]);
    if (sku) attributes.push({ name: "SKU", value: sku });

    const sellerRating = pickString(item, ["seller_rating", "sellerRating"]);
    if (sellerRating) {
      attributes.push({ name: "Rating Penjual", value: sellerRating });
    }
    const sellingTags = pickStringArray(item.selling_tags ?? item.sellingTags);
    if (sellingTags.length > 0) {
      attributes.push({ name: "Tag Penjual", value: sellingTags.join(", ") });
    }
    if (typeof item.in_stock === "boolean") {
      attributes.push({
        name: "Status Stok",
        value: item.in_stock ? "Tersedia" : "Habis",
      });
    }
    const purchaseMax = pickNumber(item, ["purchase_max", "purchaseMax"]);
    if (purchaseMax != null && purchaseMax > 0) {
      attributes.push({ name: "Maks. Pembelian", value: String(purchaseMax) });
    }

    const ratingDistribution = parseRatingDistribution(
      item.rating_distribution ?? item.ratingDistribution,
    );

    out.push({
      externalId: pickExternalId(item, i),
      name,
      productUrl,
      imageUrl:
        pickString(item, ["image_url", "imageUrl", "image", "thumbnail"]) ??
        null,
      price,
      rating: pickNumber(item, ["rating_star", "rating", "stars", "score"]),
      reviewCount: pickMarketplaceReviewCount(item),
      hasPromo,
      promoText,
      categoryRank: pickNumber(item, ["rank", "categoryRank", "page"]),
      shopName:
        pickString(item, ["shop_name", "shopName", "seller_name", "seller"]) ??
        null,
      soldCount,
      exactSold,
      historicalSold,
      monthlySold: metrics.monthlySold,
      estimatedRevenue,
      stock: metrics.stock,
      shopLocation,
      isOfficialShop: metrics.isOfficialShop,
      description,
      brand: pickString(item, ["brand", "brand_name", "brandName"]),
      category:
        pickString(item, ["category", "category_name"]) ??
        (categoryPath.length > 0 ? categoryPath[categoryPath.length - 1]! : null),
      categoryPath: categoryPath.length > 0 ? categoryPath : undefined,
      currency: pickString(item, ["currency", "currency_code"]),
      attributes: attributes.length > 0 ? attributes : undefined,
      ratingDistribution,
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
 * `lazada-product` (detail) TIDAK bisa mengambil total sold asli — hanya angka
 * flash sale (atau kosong). Total asli hanya ada di list view (`lazada-search`).
 * Cocokkan via item_id. Best-effort: kembalikan null bila search diblokir x5sec
 * atau produk tak ada di hasil — lebih baik kosong daripada angka menyesatkan.
 */
async function fetchLazadaRealSoldViaSearch(
  productName: string | null,
  itemId: string | null,
): Promise<number | null> {
  if (!productName || !itemId) return null;
  try {
    const run = await startVpsActorRun(
      "lazada-search",
      {
        keyword: productName.slice(0, 60),
        page: 1,
        limit: 100,
        download_images: false,
      },
      { wait: true, timeout: 300, throwOnFailed: false },
    );
    if (run.status === "failed") return null;
    const items = await loadAllVpsRunItems(run);
    const match = items.find(
      (it) => String(it.item_id ?? it.itemId ?? "") === String(itemId),
    );
    return match ? parseLazadaSoldText(match.sold_text ?? match.soldText) : null;
  } catch {
    return null;
  }
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

  const product = products[0]!;

  // `sold` dari detail = flash sale, bukan total. Ambil total asli via search
  // (cocokkan item_id) lalu turunkan angka flash sale jadi atribut terpisah.
  const itemId = extractLazadaItemId(normalizedUrl) ?? product.externalId;
  const flashSaleSold = product.exactSold;
  const realSold = await fetchLazadaRealSoldViaSearch(product.name, itemId);

  product.exactSold = realSold;
  product.historicalSold = realSold;
  product.soldCount = realSold;
  product.estimatedRevenue =
    product.price != null && realSold != null && realSold > 0
      ? product.price * realSold
      : null;

  if (
    flashSaleSold != null &&
    flashSaleSold > 0 &&
    flashSaleSold !== realSold
  ) {
    product.attributes = [
      ...(product.attributes ?? []),
      {
        name: "Terjual (Flash Sale)",
        value: String(flashSaleSold).replace(/\B(?=(\d{3})+(?!\d))/g, "."),
      },
    ];
  }

  return product;
}

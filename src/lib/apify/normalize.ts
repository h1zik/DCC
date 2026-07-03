import "server-only";

import { extractVpsProductMetrics, pickMarketplaceReviewCount } from "@/lib/scraper-api/product-metrics";
import { parseCompactCount } from "@/lib/research/shop-product-metrics";

export type NormalizedReview = {
  externalId: string;
  author: string | null;
  rating: number | null;
  text: string;
  reviewDate: Date | null;
};

/** Spesifikasi produk (mis. {name: "Volume", value: "200ml"}). */
export type ProductAttribute = { name: string; value: string };
/** Pilihan varian (mis. {name: "Ukuran", options: ["Single", "Twinpack"]}). */
export type ProductVariation = { name: string; options: string[] };
/** Varian/SKU konkret dengan harga & stok masing-masing. */
export type ProductModel = {
  modelId: string | null;
  name: string | null;
  price: number | null;
  priceBeforeDiscount: number | null;
  stock: number | null;
  sold: number | null;
};

export type NormalizedShopProduct = {
  externalId: string;
  name: string;
  productUrl: string;
  imageUrl: string | null;
  /** Galeri gambar produk (image_urls dari scraper VPS); kosong jika tak tersedia. */
  imageUrls?: string[];
  price: number | null;
  rating: number | null;
  reviewCount: number;
  hasPromo: boolean;
  promoText: string | null;
  categoryRank: number | null;
  shopName: string | null;
  /** Primary sold for sort/analytics — historicalSold ?? exactSold. */
  soldCount: number | null;
  exactSold: number | null;
  historicalSold: number | null;
  monthlySold: number | null;
  estimatedRevenue: number | null;
  stock: number | null;
  shopLocation: string | null;
  isOfficialShop: boolean;
  // Detail kaya (terutama dari VPS shopee-product); opsional agar normalizer lain tetap valid.
  description?: string | null;
  brand?: string | null;
  category?: string | null;
  categoryPath?: string[];
  currency?: string | null;
  attributes?: ProductAttribute[];
  variations?: ProductVariation[];
  models?: ProductModel[];
  /** Histogram bintang, mis. { "5": 8, "4": 0, ... } — dari enrichment Lazada. */
  ratingDistribution?: Record<string, number> | null;
};

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function pickImageUrl(obj: Record<string, unknown>): string | null {
  const direct = pickString(obj, [
    "imageUrl",
    "image_url",
    "image",
    "mainImage",
    "main_image",
    "thumbnail",
    "thumb",
    "coverImage",
    "cover_image",
    "productImage",
    "product_image",
  ]);
  if (direct) return direct;

  const images = obj.images ?? obj.imageUrls ?? obj.image_urls;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === "string" && first.trim()) return first.trim();
    if (first && typeof first === "object") {
      const img = first as Record<string, unknown>;
      return pickString(img, ["url", "src", "imageUrl", "original"]) ?? null;
    }
  }

  const nested = obj.item_basic ?? obj.itemBasic ?? obj.product;
  if (nested && typeof nested === "object") {
    return pickImageUrl(nested as Record<string, unknown>);
  }

  return null;
}

function pickCompactCount(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
    if (typeof v === "string") {
      const parsed = parseCompactCount(v);
      if (parsed != null) return parsed;
    }
  }
  return null;
}

/** Shopee ID sering kirim harga dalam satuan ×100000 atau nested di price_min. */
function pickShopeePrice(item: Record<string, unknown>): number | null {
  const raw = pickNumber(item, [
    "price",
    "currentPrice",
    "salePrice",
    "sale_price_value",
    "amount",
    "price_min",
    "priceMin",
    "minPrice",
    "avg_price",
    "min_price",
  ]);

  if (raw == null) {
    const nested = item.item_basic ?? item.itemBasic;
    if (nested && typeof nested === "object") {
      return pickShopeePrice(nested as Record<string, unknown>);
    }
    return null;
  }

  if (raw >= 1_000_000_000) return Math.round(raw / 100_000);
  return raw;
}

function pickDate(obj: Record<string, unknown>, keys: string[]): Date | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" || typeof v === "number") {
      if (typeof v === "string" && /^\d{10,13}$/.test(v.trim())) {
        const n = Number(v);
        if (Number.isFinite(n)) {
          const d = new Date(n > 1e12 ? n : n * 1000);
          if (!Number.isNaN(d.getTime())) return d;
        }
      }
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

/** gio21/shopee-product-detail — review ada di `recentReviews` per produk. */
export function normalizeShopeeProductDetailReviews(
  items: Record<string, unknown>[],
): NormalizedReview[] {
  const out: NormalizedReview[] = [];
  for (const item of items) {
    if (item.error != null) continue;

    const recent = item.recentReviews;
    if (!Array.isArray(recent)) continue;

    const itemId = item.itemId != null ? String(item.itemId) : "product";
    for (let i = 0; i < recent.length; i += 1) {
      const r = recent[i] as Record<string, unknown>;
      const text =
        pickString(r, ["comment", "text", "review", "content"]) ?? "";
      if (!text.trim()) continue;

      out.push({
        externalId:
          pickString(r, ["id", "reviewId", "cmtid"]) ??
          `${itemId}-${i}`,
        author: pickString(r, ["author", "username", "userName"]),
        rating: pickNumber(r, ["rating", "rating_star", "stars"]),
        text: text.trim(),
        reviewDate: pickDate(r, ["date", "reviewDate", "ctime", "create_time"]),
      });
    }
  }
  return out;
}

/** Pesan error dari baris dataset actor (mis. sian status=error). */
export function extractDatasetScrapeErrors(
  items: Record<string, unknown>[],
): string | null {
  const messages: string[] = [];
  for (const item of items) {
    if (item.error != null) {
      const err =
        typeof item.error === "string"
          ? item.error
          : typeof item.error === "object" &&
              item.error &&
              "message" in item.error &&
              typeof (item.error as { message: unknown }).message === "string"
            ? (item.error as { message: string }).message
            : null;
      if (err?.trim()) messages.push(err.trim());
    }
    const status = pickString(item, ["status"]);
    if (status === "error" || status === "failed") {
      const msg = pickString(item, [
        "errorMessage",
        "error_message",
        "message",
      ]);
      if (msg) messages.push(msg);
    }
  }
  if (messages.length === 0) return null;
  return [...new Set(messages)].join("; ");
}

/** Pesan error dari output actor Apify (mis. gio21 `no_pdp_payload`). */
export function extractApifyScrapeErrorMessage(
  items: Record<string, unknown>[],
): string | null {
  for (const item of items) {
    const err = item.error;
    if (typeof err !== "string" || !err.trim()) continue;
    if (err === "no_pdp_payload") {
      return "Gio21 tidak bisa membaca halaman produk Shopee. Coba scrape ulang atau pastikan URL produk valid.";
    }
    return `Scraper Apify: ${err}`;
  }
  return null;
}

export type ReviewScrapeMeta = {
  /** Total review all-time yang dilaporkan marketplace (mis. Shopee `reviewCount`). */
  totalReviewsReported: number | null;
  /** Berapa review yang benar-benar bisa di-fetch oleh scraper. */
  reviewsAccessible: number | null;
  /** True bila scraper berhasil mengambil seluruh review produk. */
  reviewsComplete: boolean | null;
  /** Pesan error VPS saat scrape gagal sebelum fallback Apify. */
  vpsError?: string | null;
};

/**
 * Ekstrak metadata review dari item product-detail (gio21/shopee-product-detail).
 * Dipakai untuk menandai "data parsial" di UI ketika marketplace membatasi akses review.
 */
export function extractReviewScrapeMeta(
  items: Record<string, unknown>[],
): ReviewScrapeMeta {
  const product = items.find((x) => x.error == null && x.recentReviews != null);
  if (!product) {
    return {
      totalReviewsReported: null,
      reviewsAccessible: null,
      reviewsComplete: null,
    };
  }

  const reviewsComplete =
    typeof product.reviewsComplete === "boolean"
      ? product.reviewsComplete
      : null;

  return {
    totalReviewsReported: pickNumber(product, ["reviewCount", "totalReviews"]),
    reviewsAccessible: pickNumber(product, ["reviewsAccessible"]),
    reviewsComplete,
  };
}

/** Review dari baris produk kulqiz (field `reviews` nested). */
export function normalizeKulqizProductReviews(
  items: Record<string, unknown>[],
): NormalizedReview[] {
  const out: NormalizedReview[] = [];
  for (const item of items) {
    const reviews = item.reviews;
    if (!Array.isArray(reviews)) continue;

    const productId =
      pickString(item, ["product_id", "productId", "id"]) ?? "product";
    for (let i = 0; i < reviews.length; i += 1) {
      const r = reviews[i] as Record<string, unknown>;
      const text =
        pickString(r, ["text", "comment", "review", "content", "body"]) ?? "";
      if (!text.trim()) continue;

      const author = pickString(r, ["author", "username", "user", "user_name"]);
      out.push({
        externalId:
          pickString(r, ["id", "review_id", "reviewId"]) ??
          contentHashId(productId, author, text.trim()),
        author,
        rating: pickNumber(r, ["rating", "stars", "score"]),
        text: text.trim(),
        reviewDate: pickDate(r, ["date", "created_at", "reviewDate", "time"]),
      });
    }
  }
  return out;
}

/**
 * Fallback externalId berbasis KONTEN, bukan index. Index (`row-3`) berubah
 * saat re-scrape mengembalikan urutan berbeda — menembus unique constraint
 * (duplikat) atau menabrak review lain (data hilang). Hash konten stabil.
 */
function contentHashId(
  prefix: string,
  ...parts: (string | number | null | undefined)[]
): string {
  const text = parts
    .filter((p) => p != null && String(p).trim().length > 0)
    .join("|");
  // FNV-1a 32-bit — cukup untuk dedup key, tanpa dependensi crypto.
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${prefix}-${hash.toString(36)}-${text.length}`;
}

/** JSON-LD review extractor output (tom2turnt/review-extractor). */
export function normalizeJsonLdReviewItems(
  items: Record<string, unknown>[],
): NormalizedReview[] {
  const out: NormalizedReview[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const nested = item.reviews;
    if (Array.isArray(nested)) {
      for (let j = 0; j < nested.length; j += 1) {
        const r = nested[j] as Record<string, unknown>;
        const text =
          pickString(r, ["body", "reviewBody", "text", "comment", "content"]) ??
          "";
        if (!text.trim()) continue;
        const nestedAuthor = pickString(r, [
          "author",
          "authorName",
          "name",
          "username",
        ]);
        out.push({
          externalId:
            pickString(r, ["id", "reviewId", "review_id"]) ??
            contentHashId("jsonld", nestedAuthor, text.trim()),
          author: nestedAuthor,
          rating: pickNumber(r, ["rating", "ratingValue", "stars", "score"]),
          text: text.trim(),
          reviewDate: pickDate(r, ["datePublished", "date", "reviewDate"]),
        });
      }
      continue;
    }

    const text =
      pickString(item, ["body", "reviewBody", "text", "comment", "content"]) ??
      "";
    if (!text.trim()) continue;

    const flatAuthor = pickString(item, [
      "author",
      "authorName",
      "name",
      "username",
    ]);
    out.push({
      externalId:
        pickString(item, ["id", "reviewId", "review_id"]) ??
        contentHashId("jsonld", flatAuthor, text.trim()),
      author: flatAuthor,
      rating: pickNumber(item, ["rating", "ratingValue", "stars", "score"]),
      text: text.trim(),
      reviewDate: pickDate(item, ["datePublished", "date", "reviewDate"]),
    });
  }
  return out;
}

export function normalizeGenericReviewItems(
  items: Record<string, unknown>[],
): NormalizedReview[] {
  const out: NormalizedReview[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const text =
      pickString(item, [
        "text",
        "comment",
        "review",
        "reviewText",
        "review_text",
        "content",
        "body",
      ]) ?? "";
    if (!text.trim()) continue;

    const externalId =
      pickString(item, ["id", "reviewId", "review_id", "externalId", "commentId"]) ??
      contentHashId(
        "row",
        pickString(item, ["author", "username", "userName", "buyer", "reviewer_name"]),
        text.trim(),
      );

    out.push({
      externalId,
      author: pickString(item, [
        "author",
        "username",
        "userName",
        "buyer",
        "reviewer_name",
      ]),
      rating: pickNumber(item, [
        "rating",
        "stars",
        "score",
        "star",
        "review_rating",
      ]),
      text: text.trim(),
      reviewDate: pickDate(item, [
        "reviewDate",
        "date",
        "createdAt",
        "timestamp",
        "time",
        "review_time",
        "created_at",
      ]),
    });
  }
  return out;
}

export function normalizeReviewItems(
  items: Record<string, unknown>[],
): NormalizedReview[] {
  const fromPdp = normalizeShopeeProductDetailReviews(items);
  if (fromPdp.length > 0) return fromPdp;

  const fromKulqiz = normalizeKulqizProductReviews(items);
  if (fromKulqiz.length > 0) return fromKulqiz;

  const fromJsonLd = normalizeJsonLdReviewItems(items);
  if (fromJsonLd.length > 0) return fromJsonLd;

  return normalizeGenericReviewItems(items);
}

export function normalizeShopProducts(
  items: Record<string, unknown>[],
): NormalizedShopProduct[] {
  const out: NormalizedShopProduct[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    if (item.error != null) continue;
    const status = pickString(item, ["status"]);
    if (status === "error" || status === "failed") continue;

    const name =
      pickString(item, [
        "name",
        "title",
        "productName",
        "productTitle",
        "product_name",
        "itemName",
      ]) ?? "";
    const productUrl =
      pickString(item, ["url", "productUrl", "link", "href"]) ?? "";
    if (!name.trim() || !productUrl.trim()) continue;

    const externalId =
      pickString(item, ["id", "productId", "product_id", "itemId", "skuId"]) ??
      (item.itemId != null
        ? String(item.itemId)
        : contentHashId("sku", name.trim(), productUrl.trim()));

    let discountPct = pickNumber(item, [
      "discountPercent",
      "discount",
      "discount_rate",
      "discount_percent",
    ]);
    const discountRate = pickNumber(item, ["discountRate"]);
    if (
      discountPct == null &&
      discountRate != null &&
      discountRate > 0 &&
      discountRate <= 1
    ) {
      discountPct = Math.round(discountRate * 100);
    }
    const isOnSale = item.isOnSale === true;
    const promoText =
      pickString(item, ["promoText", "promotion", "discountLabel", "badge", "discountFormat"]) ??
      (isOnSale && discountPct != null ? `Diskon ${discountPct}%` : null);
    const metrics = extractVpsProductMetrics(item);
    const sold = metrics.soldCount ?? pickCompactCount(item, [
      "sold",
      "historicalSold",
      "historicalSoldEstimated",
      "soldCount",
      "sold_count",
    ]);

    out.push({
      externalId,
      name: name.trim(),
      productUrl: productUrl.trim(),
      imageUrl: pickImageUrl(item),
      price: pickShopeePrice(item) ?? pickNumber(item, ["min_price", "avg_price", "max_price"]),
      rating: pickNumber(item, ["rating", "stars", "score", "product_rating", "rating_star"]),
      reviewCount: pickMarketplaceReviewCount(item),
      hasPromo: !!promoText || isOnSale || discountPct != null,
      promoText,
      categoryRank: pickNumber(item, [
        "rank",
        "categoryRank",
        "position",
        "rank_global",
        "rank_on_page",
      ]),
      shopName: pickString(item, [
        "shopName",
        "shop_name",
        "sellerName",
        "seller_name",
        "seller",
        "brandName",
        "storeName",
      ]),
      soldCount: metrics.soldCount ?? sold,
      exactSold: metrics.exactSold ?? sold,
      historicalSold: metrics.historicalSold ?? sold,
      monthlySold: metrics.monthlySold,
      estimatedRevenue: metrics.estimatedRevenue,
      stock: metrics.stock,
      shopLocation: metrics.shopLocation,
      isOfficialShop: metrics.isOfficialShop,
    });
  }
  return out;
}

/** Data demo saat Apify belum dikonfigurasi (development). */
export function generateDemoReviews(count = 48): NormalizedReview[] {
  const complaints = [
    "Tekstur lengket di kulit",
    "Aroma terlalu kuat",
    "Pump mudah macet",
    "Kurang melembapkan",
    "Packaging mudah bocor",
  ];
  const praises = [
    "Cepat menyerap",
    "Wanginya enak",
    "Kulit jadi lembut",
    "Harga worth it",
    "Tekstur ringan",
  ];
  const authors = ["Buyer A", "Buyer B", "Sari", "Dewi", "Rina", "Andi"];

  const reviews: NormalizedReview[] = [];
  for (let i = 0; i < count; i += 1) {
    const isNegative = i % 9 === 0;
    const isNeutral = i % 7 === 0 && !isNegative;
    const text = isNegative
      ? complaints[i % complaints.length]!
      : isNeutral
        ? "Biasa saja, tidak ada yang spesial."
        : praises[i % praises.length]!;

    reviews.push({
      externalId: `demo-${i}`,
      author: authors[i % authors.length]!,
      rating: isNegative ? 2 : isNeutral ? 3 : 5,
      text,
      reviewDate: new Date(Date.now() - i * 86400000 * 2),
    });
  }
  return reviews;
}

export function generateDemoShopProducts(): NormalizedShopProduct[] {
  const demo = (
    partial: Omit<NormalizedShopProduct, "exactSold" | "historicalSold" | "monthlySold" | "estimatedRevenue" | "stock" | "shopLocation" | "isOfficialShop">,
  ): NormalizedShopProduct => ({
    ...partial,
    exactSold: partial.soldCount,
    historicalSold: partial.soldCount,
    monthlySold: partial.soldCount != null ? Math.round(partial.soldCount * 0.15) : null,
    estimatedRevenue:
      partial.soldCount != null && partial.price != null
        ? partial.soldCount * partial.price
        : null,
    stock: 500,
    shopLocation: "Jakarta",
    isOfficialShop: true,
  });

  return [
    demo({
      externalId: "demo-sku-1",
      name: "Body Lotion Brightening 200ml",
      productUrl: "https://example.com/product/1",
      imageUrl: null,
      price: 89000,
      rating: 4.8,
      reviewCount: 1247,
      hasPromo: true,
      promoText: "Diskon 15%",
      categoryRank: 3,
      shopName: "GlowLab Official",
      soldCount: 5200,
    }),
    demo({
      externalId: "demo-sku-2",
      name: "Body Serum Glow 150ml",
      productUrl: "https://example.com/product/2",
      imageUrl: null,
      price: 125000,
      rating: 4.6,
      reviewCount: 892,
      hasPromo: false,
      promoText: null,
      categoryRank: 7,
      shopName: "PureSkin Store",
      soldCount: 3100,
    }),
    demo({
      externalId: "demo-sku-3",
      name: "Hand Cream Repair 50g",
      productUrl: "https://example.com/product/3",
      imageUrl: null,
      price: 45000,
      rating: 4.9,
      reviewCount: 445,
      hasPromo: false,
      promoText: null,
      categoryRank: 12,
      shopName: "CarePlus Beauty",
      soldCount: 890,
    }),
  ];
}

export function generateDemoDiscoveryProducts(
  keyword: string,
  limit: number,
): NormalizedShopProduct[] {
  const shops = [
    "GlowLab Official",
    "PureSkin Store",
    "CarePlus Beauty",
    "Natura ID",
    "BeautyMart",
    "SkinFirst",
    "HerbalCare",
    "FreshBody",
  ];
  const seed = keyword.trim() || "produk";
  const count = Math.min(Math.max(limit, 1), 100);
  const products: NormalizedShopProduct[] = [];

  for (let i = 0; i < count; i += 1) {
    const shop = shops[i % shops.length]!;
    const sold = 500 + i * 120;
    products.push({
      externalId: `demo-discovery-${i}`,
      name: `${seed} ${i % 3 === 0 ? "Premium" : i % 3 === 1 ? "Original" : "Bundle"} ${100 + i * 10}ml`,
      productUrl: `https://example.com/demo/${seed.replace(/\s+/g, "-")}/${i}`,
      price: 35000 + i * 2500,
      rating: 4 + (i % 10) / 10,
      reviewCount: 100 + i * 37,
      hasPromo: i % 4 === 0,
      promoText: i % 4 === 0 ? "Flash Sale" : null,
      categoryRank: i + 1,
      shopName: shop,
      soldCount: sold,
      exactSold: sold,
      historicalSold: sold,
      monthlySold: Math.round(sold * 0.12),
      estimatedRevenue: sold * (35000 + i * 2500),
      stock: 200 + i * 10,
      shopLocation: "Jakarta",
      isOfficialShop: i % 2 === 0,
      imageUrl: null,
    });
  }

  return products;
}

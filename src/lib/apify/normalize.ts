import "server-only";

export type NormalizedReview = {
  externalId: string;
  author: string | null;
  rating: number | null;
  text: string;
  reviewDate: Date | null;
};

export type NormalizedShopProduct = {
  externalId: string;
  name: string;
  productUrl: string;
  price: number | null;
  rating: number | null;
  reviewCount: number;
  hasPromo: boolean;
  promoText: string | null;
  categoryRank: number | null;
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

/** Shopee ID sering kirim harga dalam satuan ×100000 atau nested di price_min. */
function pickShopeePrice(item: Record<string, unknown>): number | null {
  const raw = pickNumber(item, [
    "price",
    "currentPrice",
    "salePrice",
    "amount",
    "price_min",
    "priceMin",
    "minPrice",
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

export type ReviewScrapeMeta = {
  /** Total review all-time yang dilaporkan marketplace (mis. Shopee `reviewCount`). */
  totalReviewsReported: number | null;
  /** Berapa review yang benar-benar bisa di-fetch oleh scraper. */
  reviewsAccessible: number | null;
  /** True bila scraper berhasil mengambil seluruh review produk. */
  reviewsComplete: boolean | null;
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

export function normalizeReviewItems(
  items: Record<string, unknown>[],
): NormalizedReview[] {
  const fromPdp = normalizeShopeeProductDetailReviews(items);
  if (fromPdp.length > 0) return fromPdp;

  const out: NormalizedReview[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const text =
      pickString(item, [
        "text",
        "comment",
        "review",
        "reviewText",
        "content",
        "body",
      ]) ?? "";
    if (!text.trim()) continue;

    const externalId =
      pickString(item, ["id", "reviewId", "externalId", "commentId"]) ??
      `row-${i}`;

    out.push({
      externalId,
      author: pickString(item, ["author", "username", "userName", "buyer"]),
      rating: pickNumber(item, ["rating", "stars", "score", "star"]),
      text: text.trim(),
      reviewDate: pickDate(item, [
        "reviewDate",
        "date",
        "createdAt",
        "timestamp",
        "time",
      ]),
    });
  }
  return out;
}

export function normalizeShopProducts(
  items: Record<string, unknown>[],
): NormalizedShopProduct[] {
  const out: NormalizedShopProduct[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    if (item.error != null) continue;

    const name =
      pickString(item, ["name", "title", "productName", "itemName"]) ?? "";
    const productUrl =
      pickString(item, ["url", "productUrl", "link", "href"]) ?? "";
    if (!name.trim() || !productUrl.trim()) continue;

    const externalId =
      pickString(item, ["id", "productId", "itemId", "skuId"]) ??
      (item.itemId != null ? String(item.itemId) : `sku-${i}`);

    const discountPct = pickNumber(item, [
      "discountPercent",
      "discount",
      "discount_rate",
    ]);
    const isOnSale = item.isOnSale === true;
    const promoText =
      pickString(item, ["promoText", "promotion", "discountLabel", "badge"]) ??
      (isOnSale && discountPct != null ? `Diskon ${discountPct}%` : null);
    const sold = pickNumber(item, ["sold", "historicalSold", "historicalSoldEstimated"]);

    out.push({
      externalId,
      name: name.trim(),
      productUrl: productUrl.trim(),
      price: pickShopeePrice(item),
      rating: pickNumber(item, ["rating", "stars", "score"]),
      reviewCount:
        pickNumber(item, [
          "reviewCount",
          "reviews",
          "ratingCount",
          "totalReviews",
          "cmt_count",
        ]) ??
        sold ??
        0,
      hasPromo: !!promoText || isOnSale || discountPct != null,
      promoText,
      categoryRank: pickNumber(item, ["rank", "categoryRank", "position"]),
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
  return [
    {
      externalId: "demo-sku-1",
      name: "Body Lotion Brightening 200ml",
      productUrl: "https://example.com/product/1",
      price: 89000,
      rating: 4.8,
      reviewCount: 1247,
      hasPromo: true,
      promoText: "Diskon 15%",
      categoryRank: 3,
    },
    {
      externalId: "demo-sku-2",
      name: "Body Serum Glow 150ml",
      productUrl: "https://example.com/product/2",
      price: 125000,
      rating: 4.6,
      reviewCount: 892,
      hasPromo: false,
      promoText: null,
      categoryRank: 7,
    },
    {
      externalId: "demo-sku-3",
      name: "Hand Cream Repair 50g",
      productUrl: "https://example.com/product/3",
      price: 45000,
      rating: 4.9,
      reviewCount: 445,
      hasPromo: false,
      promoText: null,
      categoryRank: 12,
    },
  ];
}

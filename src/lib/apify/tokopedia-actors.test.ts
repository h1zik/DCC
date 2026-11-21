import { afterEach, describe, expect, it } from "vitest";
import {
  buildTokopediaProductInput,
  buildTokopediaReviewsInput,
  buildTokopediaSearchInput,
  buildTokopediaShopInput,
  getTokopediaReviewsActorId,
  getTokopediaSearchActorId,
  normalizeTokopediaShopUrl,
  TOKOPEDIA_ACTOR_DEFAULTS,
} from "@/lib/apify/tokopedia-actors";
import {
  extractReviewScrapeMeta,
  normalizeReviewItems,
  normalizeShopProducts,
  normalizeTokopediaReviews,
} from "@/lib/apify/normalize";

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

describe("tokopedia actor ids", () => {
  it("falls back to defaults when env is unset or empty", () => {
    delete process.env.APIFY_ACTOR_TOKOPEDIA_SEARCH;
    process.env.APIFY_ACTOR_TOKOPEDIA_REVIEWS = "";
    expect(getTokopediaSearchActorId()).toBe(TOKOPEDIA_ACTOR_DEFAULTS.search);
    expect(getTokopediaReviewsActorId()).toBe(TOKOPEDIA_ACTOR_DEFAULTS.reviews);
  });

  it("respects env overrides", () => {
    process.env.APIFY_ACTOR_TOKOPEDIA_SEARCH = "someone~other";
    expect(getTokopediaSearchActorId()).toBe("someone~other");
  });
});

describe("tokopedia actor inputs", () => {
  it("search sends one keyword and clamps the limit", () => {
    expect(buildTokopediaSearchInput("  serum wajah ", 900)).toEqual({
      keywords: ["serum wajah"],
      maxItems: 500,
    });
  });

  it("shop reduces any shop page URL to the shop root", () => {
    expect(
      buildTokopediaShopInput("tokopedia.com/tomkinsofficial/product?page=2"),
    ).toEqual({
      startUrls: ["https://tokopedia.com/tomkinsofficial"],
      maxItems: 100,
    });
    expect(
      normalizeTokopediaShopUrl("https://www.tokopedia.com/tomkinsofficial/etalase/sneakers"),
    ).toBe("https://www.tokopedia.com/tomkinsofficial");
  });

  it("rejects non-Tokopedia shop URLs", () => {
    expect(() => normalizeTokopediaShopUrl("https://shopee.co.id/toko")).toThrow(
      "URL harus dari tokopedia.com.",
    );
  });

  it("product opens the detail page and strips tracking params", () => {
    expect(
      buildTokopediaProductInput(
        "https://www.tokopedia.com/toko/produk-a-123?extParam=abc&src=topads",
      ),
    ).toEqual({
      startUrls: ["https://www.tokopedia.com/toko/produk-a-123"],
      scrapeDetails: true,
      maxItems: 1,
    });
  });

  it("reviews ask for one row per review", () => {
    expect(
      buildTokopediaReviewsInput("https://www.tokopedia.com/toko/produk-a-123?x=1"),
    ).toEqual({
      outputMode: "reviews",
      startUrls: ["https://www.tokopedia.com/toko/produk-a-123"],
      reviewSort: "newest",
      maxReviewsPerProduct: 500,
      maxItems: 500,
    });
  });
});

/** Bentuk baris mengikuti contoh output di README actor memo23/tokopedia-scraper. */
describe("tokopedia product rows", () => {
  const listingRow = {
    productId: "100070724287",
    productName: "PVN Taeri Sepatu Sneakers Olahraga Wanita",
    productUrl: "https://www.tokopedia.com/pavillionshoes/pvn-taeri-1730635635437963091",
    imageUrl: "https://images.tokopedia.net/img/a.jpg",
    price: 187181,
    originalPrice: 499900,
    discountPercentage: 63,
    currency: "IDR",
    rating: 4.9,
    soldCount: 296248,
    categoryName: "Sneakers Wanita",
    shopName: "pvnshoes",
    shopCity: "Tangerang",
    shopType: "official_store",
    source: "search",
    searchKeyword: "sepatu",
    position: 1,
  };

  it("maps listing fields", () => {
    const [p] = normalizeShopProducts([listingRow]);
    expect(p).toMatchObject({
      externalId: "100070724287",
      name: "PVN Taeri Sepatu Sneakers Olahraga Wanita",
      productUrl: listingRow.productUrl,
      imageUrl: "https://images.tokopedia.net/img/a.jpg",
      price: 187181,
      rating: 4.9,
      hasPromo: true,
      categoryRank: 1,
      shopName: "pvnshoes",
      soldCount: 296248,
      shopLocation: "Tangerang",
      isOfficialShop: true,
      category: "Sneakers Wanita",
      currency: "IDR",
    });
  });

  it("maps detail fields when the product page was opened", () => {
    const [p] = normalizeShopProducts([
      {
        ...listingRow,
        description: "Sepatu olahraga ringan.",
        brand: "PVN",
        stock: 189,
        ratingCount: 40092,
        ratingBreakdown: { "1": 177, "2": 107, "3": 370, "4": 3092, "5": 36346 },
        specifications: [
          { name: "Kondisi", value: "Baru" },
          { name: "Kategori", value: "Sneakers Wanita" },
        ],
        images: ["https://images.tokopedia.net/img/a.jpg", "https://images.tokopedia.net/img/b.jpg"],
        // Baris produk bisa membawa review bersarang; itu bukan jumlah review.
        reviews: [{ reviewId: "1", rating: 5, text: "Pas" }],
      },
    ]);
    expect(p).toMatchObject({
      reviewCount: 40092,
      stock: 189,
      description: "Sepatu olahraga ringan.",
      brand: "PVN",
      attributes: [
        { name: "Kondisi", value: "Baru" },
        { name: "Kategori", value: "Sneakers Wanita" },
      ],
      imageUrls: [
        "https://images.tokopedia.net/img/a.jpg",
        "https://images.tokopedia.net/img/b.jpg",
      ],
      ratingDistribution: { "1": 177, "2": 107, "3": 370, "4": 3092, "5": 36346 },
    });
  });

  it("treats a non-official shop as not official", () => {
    const [p] = normalizeShopProducts([{ ...listingRow, shopType: "power_shop" }]);
    expect(p!.isOfficialShop).toBe(false);
  });
});

describe("tokopedia review rows", () => {
  const rows = [
    {
      reviewId: "2318519907",
      rating: 5,
      text: "Bentuk dan ukuran: Pas",
      variantName: "White - 40(5)",
      createdAt: "2026-09-24T15:24:54.000Z",
      reviewerName: "Sari",
      productId: "100070724287",
      productUrl: "https://www.tokopedia.com/pavillionshoes/pvn-taeri-1730635635437963091",
      writtenReviewCount: 3,
    },
    {
      reviewId: "702618568",
      rating: 1,
      text: "minta ukuran 39 dikasih 33",
      createdAtText: "Lebih dari 1 tahun lalu",
      createdAtApprox: "2025-09-25",
      isAnonymous: true,
      writtenReviewCount: 3,
    },
    // Tanpa teks dan duplikat — keduanya dilewati.
    { reviewId: "3", rating: 4, text: "", writtenReviewCount: 3 },
    { reviewId: "2318519907", rating: 5, text: "Bentuk dan ukuran: Pas", writtenReviewCount: 3 },
  ];

  it("keeps written reviews with author, rating and date", () => {
    const out = normalizeTokopediaReviews(rows);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      externalId: "2318519907",
      author: "Sari",
      rating: 5,
      text: "Bentuk dan ukuran: Pas",
    });
    expect(out[0]!.reviewDate?.toISOString()).toBe("2026-09-24T15:24:54.000Z");
  });

  it("falls back to the approximate date and a null author", () => {
    const [, anonymous] = normalizeTokopediaReviews(rows);
    expect(anonymous!.author).toBeNull();
    expect(anonymous!.reviewDate?.toISOString().slice(0, 10)).toBe("2025-09-25");
  });

  it("is picked by the generic review normalizer", () => {
    expect(normalizeReviewItems(rows).map((r) => r.externalId)).toEqual([
      "2318519907",
      "702618568",
    ]);
  });

  it("reports completeness against the written review total", () => {
    expect(extractReviewScrapeMeta(rows)).toEqual({
      totalReviewsReported: 3,
      reviewsAccessible: 4,
      reviewsComplete: true,
    });
    expect(
      extractReviewScrapeMeta(rows.map((r) => ({ ...r, writtenReviewCount: 10000 }))),
    ).toMatchObject({ totalReviewsReported: 10000, reviewsComplete: false });
  });
});

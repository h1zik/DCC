import { afterEach, describe, expect, it } from "vitest";
import {
  buildShopeeProductInput,
  buildShopeeReviewsInput,
  buildShopeeSearchInput,
  buildShopeeShopInput,
  getShopeeReviewsActorId,
  getShopeeSearchActorId,
  SHOPEE_ACTOR_DEFAULTS,
} from "@/lib/apify/shopee-actors";
import {
  extractApifyScrapeErrorMessage,
  extractReviewScrapeMeta,
  normalizeShopProducts,
  normalizeShopeeShopReviews,
} from "@/lib/apify/normalize";

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

describe("shopee actor ids", () => {
  it("falls back to defaults when env is empty", () => {
    delete process.env.APIFY_ACTOR_SHOPEE_SEARCH;
    delete process.env.APIFY_ACTOR_SHOPEE_REVIEWS;
    expect(getShopeeSearchActorId()).toBe(SHOPEE_ACTOR_DEFAULTS.search);
    expect(getShopeeReviewsActorId()).toBe(SHOPEE_ACTOR_DEFAULTS.reviews);
  });

  it("respects env overrides", () => {
    process.env.APIFY_ACTOR_SHOPEE_SEARCH = "someone~other";
    expect(getShopeeSearchActorId()).toBe("someone~other");
  });
});

describe("shopee actor inputs", () => {
  it("search uses xtracto keyword mode", () => {
    expect(buildShopeeSearchInput("  serum wajah ", 900)).toEqual({
      mode: "keyword",
      keyword: "serum wajah",
      country: "id",
      sort: "relevancy",
      maxProducts: 500,
    });
  });

  it("shop strips query string and detects country", () => {
    expect(buildShopeeShopInput("https://shopee.com.my/someshop?x=1")).toEqual({
      shop: "https://shopee.com.my/someshop",
      country: "my",
      maxProducts: 100,
    });
  });

  it("product uses url mode with detail", () => {
    expect(
      buildShopeeProductInput("https://shopee.co.id/Serum-i.123.456?sp_atk=abc"),
    ).toMatchObject({ mode: "url", url: "https://shopee.co.id/Serum-i.123.456", fetchDetail: true });
  });

  it("reviews use dami startUrls as plain strings", () => {
    expect(buildShopeeReviewsInput("https://shopee.co.id/product/1/2?a=b")).toEqual({
      startUrls: ["https://shopee.co.id/product/1/2"],
      maxReviewsPerShop: 500,
      onlyWithText: true,
      includeShopSummary: false,
    });
  });
});

describe("xtracto product rows", () => {
  it("maps card fields", () => {
    const [p] = normalizeShopProducts([
      {
        shop_id: 11,
        item_id: 22,
        name: "Serum A",
        url: "https://shopee.co.id/product/11/22",
        image_url: "https://img/1.jpg",
        price: 45000,
        original_price: 60000,
        discount_pct: 25,
        rating: 4.8,
        rating_count: 120,
        sold_count: 1500,
        location: "KOTA JAKARTA",
        is_mall: true,
        currency: "IDR",
      },
    ]);
    expect(p).toMatchObject({
      externalId: "22",
      name: "Serum A",
      imageUrl: "https://img/1.jpg",
      price: 45000,
      rating: 4.8,
      reviewCount: 120,
      hasPromo: true,
      soldCount: 1500,
      shopLocation: "KOTA JAKARTA",
      isOfficialShop: true,
    });
  });

  it("maps detail fields incl. shop object", () => {
    const [p] = normalizeShopProducts([
      {
        item_id: 33,
        title: "Toner B",
        url: "https://shopee.co.id/Toner-i.1.33",
        price: 30000,
        rating_star: 4.5,
        total_ratings: 80,
        sold: 200,
        shop: { name: "Toko B", follower_count: 10 },
      },
    ]);
    expect(p).toMatchObject({
      externalId: "33",
      name: "Toner B",
      rating: 4.5,
      reviewCount: 80,
      shopName: "Toko B",
    });
  });
});

describe("dami review rows", () => {
  const rows = [
    { type: "shop", shop_name: "Toko", charged: false },
    {
      type: "review",
      cmtid: 9001,
      itemid: 22,
      rating_star: 5,
      comment: "Bagus banget",
      author_username: "a***b",
      review_date: "2026-10-01T00:00:00.000Z",
    },
    { type: "review", cmtid: 9002, rating_star: 4, comment: "" },
    { type: "review", cmtid: 9001, rating_star: 5, comment: "Bagus banget" },
    { type: "notice", reason: "TIME_LIMIT", message: "stopped", charged: false },
  ];

  it("keeps text reviews, skips summary/notice/empty/duplicate rows", () => {
    const out = normalizeShopeeShopReviews(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      externalId: "9001",
      author: "a***b",
      rating: 5,
      text: "Bagus banget",
    });
    expect(out[0]!.reviewDate?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("marks truncated runs as incomplete and ignores benign notices as errors", () => {
    expect(extractReviewScrapeMeta(rows)).toEqual({
      totalReviewsReported: null,
      reviewsAccessible: 3,
      reviewsComplete: false,
    });
    expect(extractApifyScrapeErrorMessage(rows)).toBeNull();
  });

  it("surfaces failure notices", () => {
    expect(
      extractApifyScrapeErrorMessage([
        { type: "notice", reason: "shop_not_found_on_host", message: "Shop not found" },
      ]),
    ).toBe("Scraper Apify (shop_not_found_on_host): Shop not found");
  });
});

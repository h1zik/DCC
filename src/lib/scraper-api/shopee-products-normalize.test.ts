import { describe, expect, it } from "vitest";
import { normalizeVpsShopeeProducts } from "@/lib/scraper-api/shopee-products";
import { toShopeeDetailUrl } from "@/lib/apify/shopee-url";

// Fixtures captured live from the VPS Brightdata Browser Scraper (2026-06).
// Shape differs from the previous scraper: discount is a signed string ("-44%"),
// sold counts arrive only as a localized display string ("1RB+ terjual") with the
// numeric sold/historical_sold null, and product_url uses the /product/{shop}/{item}
// form that the detail actor cannot parse.

const SEARCH_ITEM = {
  marketplace: "shopee",
  item_id: "16501270789",
  shop_id: "72057456",
  title: "B'Dermabeauty serum dna salmon",
  price: 84000,
  price_before_discount: 149000,
  currency: "IDR",
  image_url: "https://down-id.img.susercontent.com/file/abc",
  rating_star: 4.91,
  rating_count: 2241,
  shop_location: "Samarinda",
  product_url: "https://shopee.co.id/product/72057456/16501270789",
  discount: "-44%",
  is_official_shop: true,
  brand: "B'dermabeauty",
  image_urls: [
    "https://down-id.img.susercontent.com/file/a",
    "https://down-id.img.susercontent.com/file/b",
    "https://down-id.img.susercontent.com/file/c",
  ],
};

const SHOP_ITEM = {
  marketplace: "shopee",
  item_id: "1268675893",
  shop_id: "72057456",
  title: "B'Dermabeauty sabun toner acne",
  price: 75000,
  price_before_discount: 75000,
  rating_star: 4.96,
  rating_count: 645,
  shop_name: "B'Dermabeauty Official Shop",
  sold: null,
  historical_sold: null,
  sold_display: "1RB+ terjual",
  product_url: "https://shopee.co.id/product/72057456/1268675893",
  discount: null,
};

describe("normalizeVpsShopeeProducts — Brightdata Browser Scraper shape", () => {
  it("reads a signed discount string as a positive promo", () => {
    const [p] = normalizeVpsShopeeProducts([SEARCH_ITEM]);
    expect(p.hasPromo).toBe(true);
    expect(p.promoText).toBe("Diskon 44%");
  });

  it("does not flag a promo when there is no discount", () => {
    const [p] = normalizeVpsShopeeProducts([SHOP_ITEM]);
    expect(p.hasPromo).toBe(false);
  });

  it("parses sold count from sold_display when numeric fields are null", () => {
    const [p] = normalizeVpsShopeeProducts([SHOP_ITEM]);
    expect(p.soldCount).toBe(1000);
    // revenue falls back to price * sold lower-bound
    expect(p.estimatedRevenue).toBe(75000 * 1000);
  });

  it("builds a stable externalId from shop_id + item_id", () => {
    const [p] = normalizeVpsShopeeProducts([SEARCH_ITEM]);
    expect(p.externalId).toBe("72057456-16501270789");
  });

  it("maps rating_count to reviewCount", () => {
    const [p] = normalizeVpsShopeeProducts([SEARCH_ITEM]);
    expect(p.reviewCount).toBe(2241);
  });

  it("captures the image_urls gallery", () => {
    const [p] = normalizeVpsShopeeProducts([SEARCH_ITEM]);
    expect(p.imageUrls).toHaveLength(3);
    expect(p.imageUrls?.[0]).toContain("/file/a");
  });

  it("converts /product/{shop}/{item} URLs to the parseable -i. form", () => {
    expect(toShopeeDetailUrl(SEARCH_ITEM.product_url)).toBe(
      "https://shopee.co.id/product-i.72057456.16501270789",
    );
    // already-canonical and non-shopee URLs pass through
    const canonical = "https://shopee.co.id/x-i.1.2";
    expect(toShopeeDetailUrl(canonical)).toBe(canonical);
  });
});

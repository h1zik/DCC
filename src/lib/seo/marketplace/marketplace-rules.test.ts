import { describe, expect, it } from "vitest";
import {
  analyzeListings,
  scoreOwnTitle,
  type MarketplaceListing,
} from "@/lib/seo/marketplace/marketplace-rules";

const listings: MarketplaceListing[] = [
  { name: "Serum Vitamin C Brightening Original BPOM", price: 50000, soldCount: 100, rating: 4.8, reviewCount: 50, isOfficialShop: true },
  { name: "Serum Vitamin C Glowing Original 30ml", price: 70000, soldCount: 200, rating: 4.6, reviewCount: 80, isOfficialShop: false },
  { name: "Serum Vitamin C Brightening Glowing BPOM", price: 60000, soldCount: 150, rating: 4.9, reviewCount: 30, isOfficialShop: true },
];

describe("analyzeListings", () => {
  it("computes stats", () => {
    const { stats } = analyzeListings(listings);
    expect(stats.count).toBe(3);
    expect(stats.medianPrice).toBe(60000);
    expect(stats.priceMin).toBe(50000);
    expect(stats.priceMax).toBe(70000);
    expect(stats.totalSold).toBe(450);
    expect(stats.avgRating).toBeCloseTo(4.8, 1);
    expect(stats.officialShopRate).toBeCloseTo(0.67, 1);
  });

  it("extracts frequent title terms excluding stopwords and numbers", () => {
    const { topTitleTerms } = analyzeListings(listings);
    const terms = topTitleTerms.map((t) => t.term);
    expect(terms).toContain("serum");
    expect(terms).toContain("vitamin");
    expect(terms).toContain("brightening");
    // angka & unit/stopword tidak masuk
    expect(terms).not.toContain("30ml");
    expect(terms).not.toContain("ml");
  });
});

describe("scoreOwnTitle", () => {
  it("rewards keyword presence and term coverage", () => {
    const { topTitleTerms, stats } = analyzeListings(listings);
    const good = scoreOwnTitle(
      "Serum Vitamin C Brightening Glowing Original BPOM 30ml",
      "serum vitamin c",
      topTitleTerms,
      stats.avgTitleLength,
    );
    expect(good.hasKeyword).toBe(true);
    expect(good.score).toBeGreaterThan(70);
  });

  it("penalizes a weak, off-keyword title", () => {
    const { topTitleTerms, stats } = analyzeListings(listings);
    const weak = scoreOwnTitle(
      "Produk Bagus",
      "serum vitamin c",
      topTitleTerms,
      stats.avgTitleLength,
    );
    expect(weak.hasKeyword).toBe(false);
    expect(weak.score).toBeLessThan(40);
    expect(weak.missingTerms.length).toBeGreaterThan(0);
  });
});

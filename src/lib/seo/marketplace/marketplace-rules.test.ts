import { describe, expect, it } from "vitest";
import {
  analyzeListings,
  keywordTokens,
  scoreOwnTitle,
  titleHasKeyword,
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

  it("extracts frequent title terms excluding stopwords, marketplace filler and numbers", () => {
    const { topTitleTerms } = analyzeListings(listings);
    const terms = topTitleTerms.map((t) => t.term);
    expect(terms).toContain("serum");
    expect(terms).toContain("vitamin");
    expect(terms).toContain("brightening");
    // angka & unit/stopword tidak masuk
    expect(terms).not.toContain("30ml");
    expect(terms).not.toContain("ml");
    // filler marketplace tidak masuk
    expect(terms).not.toContain("original");
    expect(terms).not.toContain("bpom");
  });

  it("drops Indonesian marketplace filler words", () => {
    const { topTitleTerms } = analyzeListings([
      { name: "Sunscreen SPF50 Murah Promo COD Ready Stok Gratis Ongkir Terlaris Resmi", price: 1, soldCount: 1, rating: 5, reviewCount: 1, isOfficialShop: false },
      { name: "Sunscreen SPF50 Best Seller Diskon Flash Sale Garansi Official Baru", price: 1, soldCount: 1, rating: 5, reviewCount: 1, isOfficialShop: false },
    ]);
    expect(topTitleTerms.map((t) => t.term)).toEqual(["sunscreen", "spf50"]);
  });
});

describe("keywordTokens / titleHasKeyword", () => {
  it("drops tokens shorter than 2 chars and dedupes", () => {
    expect(keywordTokens("serum vitamin c")).toEqual(["serum", "vitamin"]);
    expect(keywordTokens("Cushion  cushion BB")).toEqual(["cushion", "bb"]);
  });

  it("matches when every keyword token is present regardless of order", () => {
    expect(titleHasKeyword("Vitamin C Serum Brightening", "serum vitamin c")).toBe(true);
    expect(titleHasKeyword("Serum Niacinamide 10%", "serum vitamin c")).toBe(false);
    expect(titleHasKeyword("Vitamin Serum", "serum vitamin")).toBe(true);
  });

  it("does not match partial tokens", () => {
    expect(titleHasKeyword("Serumku Vitamin", "serum vitamin")).toBe(false);
  });

  it("returns false for an empty keyword", () => {
    expect(titleHasKeyword("Serum", "   ")).toBe(false);
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

  it("detects the keyword token-wise even when the word order differs", () => {
    const { topTitleTerms, stats } = analyzeListings(listings);
    const reordered = scoreOwnTitle(
      "Vitamin C Serum Brightening Glowing",
      "serum vitamin c",
      topTitleTerms,
      stats.avgTitleLength,
    );
    expect(reordered.hasKeyword).toBe(true);
  });

  it("does not count keyword tokens as coverage terms", () => {
    const { topTitleTerms, stats } = analyzeListings(listings);
    const onlyKeyword = scoreOwnTitle(
      "Serum Vitamin C",
      "serum vitamin c",
      topTitleTerms,
      stats.avgTitleLength,
    );
    expect(onlyKeyword.coveredTerms).not.toContain("serum");
    expect(onlyKeyword.coveredTerms).not.toContain("vitamin");
    expect(onlyKeyword.coveredTerms).toEqual([]);
    expect(onlyKeyword.missingTerms).toEqual(
      expect.arrayContaining(["brightening", "glowing"]),
    );
    // keyword (30) saja: tanpa coverage, judul terlalu pendek
    expect(onlyKeyword.score).toBe(30);
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

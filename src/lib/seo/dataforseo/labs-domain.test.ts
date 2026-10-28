import { describe, expect, it } from "vitest";
import {
  RANKED_KEYWORDS_VERIFY_BATCH,
  buildPageIntersectionPayload,
  buildRankedKeywordsForKeywordsPayload,
  buildRankedKeywordsPayload,
  chunkKeywordsForVerification,
  parsePageIntersectionRows,
  pickBestRankedPositions,
} from "@/lib/seo/dataforseo/labs-domain";

describe("ranked keywords verification helpers", () => {
  it("chunks unique keywords into batches of at most 100", () => {
    const keywords = Array.from({ length: 250 }, (_, i) => `kw ${i}`);
    const batches = chunkKeywordsForVerification(keywords);
    expect(batches.map((b) => b.length)).toEqual([100, 100, 50]);
    expect(batches.flat()).toEqual(keywords);
  });

  it("dedupes case-insensitively and drops blanks before chunking", () => {
    expect(
      chunkKeywordsForVerification(["Serum", "serum ", "", "  ", "toner"], 10),
    ).toEqual([["Serum", "toner"]]);
  });

  it("never exceeds the API batch cap even when asked", () => {
    const keywords = Array.from({ length: 150 }, (_, i) => `kw ${i}`);
    const batches = chunkKeywordsForVerification(keywords, 500);
    expect(batches[0]).toHaveLength(RANKED_KEYWORDS_VERIFY_BATCH);
  });

  it("builds an organic ranked_keywords payload filtered to the given keywords", () => {
    const payload = buildRankedKeywordsForKeywordsPayload(
      "brand.com",
      ["serum niacinamide", "toner exfoliating"],
      { locationCode: 2360, languageCode: "id" },
    );
    expect(payload).toMatchObject({
      target: "brand.com",
      location_code: 2360,
      language_code: "id",
      item_types: ["organic"],
      filters: ["keyword_data.keyword", "in", ["serum niacinamide", "toner exfoliating"]],
    });
    expect(payload.limit as number).toBeGreaterThanOrEqual(10);
    expect(payload.limit as number).toBeLessThanOrEqual(1000);
  });

  it("truncates the filter list to the batch cap", () => {
    const keywords = Array.from({ length: 150 }, (_, i) => `kw ${i}`);
    const payload = buildRankedKeywordsForKeywordsPayload("brand.com", keywords, {
      locationCode: 2360,
      languageCode: "id",
    });
    const filters = payload.filters as [string, string, string[]];
    expect(filters[2]).toHaveLength(RANKED_KEYWORDS_VERIFY_BATCH);
  });

  it("keeps the best position per keyword (lower-cased key)", () => {
    const best = pickBestRankedPositions([
      { keyword: "Serum", position: 12, searchVolume: 10, difficulty: null, etv: null, url: "a" },
      { keyword: "serum", position: 4, searchVolume: 10, difficulty: null, etv: null, url: "b" },
      { keyword: "toner", position: null, searchVolume: 5, difficulty: null, etv: null, url: null },
      { keyword: "toner", position: 30, searchVolume: 5, difficulty: null, etv: null, url: "c" },
    ]);
    expect(best.get("serum")?.position).toBe(4);
    expect(best.get("serum")?.url).toBe("b");
    expect(best.get("toner")?.position).toBe(30);
  });
});

describe("DataForSEO Labs request contracts", () => {
  it("requests only organic ranked keywords and respects the API maximum", () => {
    expect(
      buildRankedKeywordsPayload("brand.com", {
        locationCode: 2360,
        languageCode: "id",
        limit: 5000,
      }),
    ).toMatchObject({
      target: "brand.com",
      location_code: 2360,
      language_code: "id",
      item_types: ["organic"],
      limit: 1000,
    });
  });

  it("requests the organic union for page comparisons", () => {
    expect(
      buildPageIntersectionPayload(
        "https://brand.com/a",
        "https://competitor.com/b",
        { locationCode: 2360, languageCode: "id" },
      ),
    ).toMatchObject({
      pages: {
        "1": "https://brand.com/a",
        "2": "https://competitor.com/b",
      },
      item_types: ["organic"],
      intersection_mode: "union",
    });
  });
});

describe("parsePageIntersectionRows", () => {
  it("reads current intersection_result keys from DataForSEO", () => {
    const rows = parsePageIntersectionRows([
      {
        keyword_data: {
          keyword: "serum niacinamide",
          keyword_info: { search_volume: 5400 },
        },
        intersection_result: {
          "1": { rank_group: 18 },
          "2": { rank_group: 4 },
        },
      },
      {
        keyword_data: {
          keyword: "toner exfoliating",
          keyword_info: { search_volume: 1900 },
        },
        intersection_result: {
          "2": { rank_group: 7 },
        },
      },
    ]);

    expect(rows).toEqual([
      {
        keyword: "serum niacinamide",
        searchVolume: 5400,
        page1Position: 18,
        page2Position: 4,
      },
      {
        keyword: "toner exfoliating",
        searchVolume: 1900,
        page1Position: null,
        page2Position: 7,
      },
    ]);
  });
});

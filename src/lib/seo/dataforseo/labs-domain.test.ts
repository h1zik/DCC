import { describe, expect, it } from "vitest";
import {
  buildPageIntersectionPayload,
  buildRankedKeywordsPayload,
  parsePageIntersectionRows,
} from "@/lib/seo/dataforseo/labs-domain";

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

import { describe, expect, it } from "vitest";
import {
  findAllDomainMatches,
  findDomainRanks,
  type SerpResultItem,
} from "@/lib/seo/dataforseo/serp-parse";

const items: SerpResultItem[] = [
  {
    type: "organic",
    rank_group: 1,
    rank_absolute: 1,
    domain: "kompetitor.co.id",
    url: "https://kompetitor.co.id/a",
  },
  {
    type: "organic",
    rank_group: 3,
    rank_absolute: 3,
    domain: "www.brand.com",
    url: "https://www.brand.com/blog/serum",
  },
  {
    type: "organic",
    rank_group: 9,
    rank_absolute: 9,
    domain: "brand.com",
    url: "https://brand.com/produk/serum",
  },
  { type: "people_also_ask", rank_group: 2, rank_absolute: 2 },
];

describe("findAllDomainMatches", () => {
  it("returns every organic hit for the domain", () => {
    const matches = findAllDomainMatches(items, "brand.com");
    expect(matches).toEqual([
      { position: 3, url: "https://www.brand.com/blog/serum" },
      { position: 9, url: "https://brand.com/produk/serum" },
    ]);
  });

  it("returns empty when domain absent", () => {
    expect(findAllDomainMatches(items, "lain.com")).toEqual([]);
  });
});

describe("findDomainRanks", () => {
  it("maps each domain to its best organic position", () => {
    expect(
      findDomainRanks(items, ["brand.com", "kompetitor.co.id", "lain.com"]),
    ).toEqual({
      "brand.com": 3,
      "kompetitor.co.id": 1,
      "lain.com": null,
    });
  });
});

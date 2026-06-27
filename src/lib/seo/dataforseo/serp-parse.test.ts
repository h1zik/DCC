import { describe, expect, it } from "vitest";
import {
  extractSerpFeatures,
  findDomainRank,
  normalizeDomain,
  type SerpResultItem,
} from "@/lib/seo/dataforseo/serp-parse";

describe("normalizeDomain", () => {
  it("strips protocol, path, and www", () => {
    expect(normalizeDomain("https://www.BrandAnda.com/produk")).toBe(
      "brandanda.com",
    );
    expect(normalizeDomain("brandanda.com")).toBe("brandanda.com");
  });
});

const items: SerpResultItem[] = [
  { type: "featured_snippet", rank_group: 1, rank_absolute: 1 },
  {
    type: "organic",
    rank_group: 1,
    rank_absolute: 2,
    domain: "kompetitor.co.id",
    url: "https://kompetitor.co.id/a",
  },
  {
    type: "organic",
    rank_group: 2,
    rank_absolute: 3,
    domain: "www.brandanda.com",
    url: "https://www.brandanda.com/produk/serum",
  },
  { type: "people_also_ask", rank_group: 1, rank_absolute: 4 },
];

describe("findDomainRank", () => {
  it("finds organic rank by domain (ignoring www)", () => {
    const result = findDomainRank(items, "brandanda.com");
    expect(result?.position).toBe(2);
    expect(result?.foundUrl).toContain("brandanda.com");
  });

  it("matches subdomains", () => {
    const result = findDomainRank(
      [
        {
          type: "organic",
          rank_group: 5,
          domain: "blog.brandanda.com",
          url: "https://blog.brandanda.com/x",
        },
      ],
      "brandanda.com",
    );
    expect(result?.position).toBe(5);
  });

  it("respects targetUrl filter", () => {
    expect(findDomainRank(items, "brandanda.com", "/produk/serum")?.position).toBe(2);
    expect(findDomainRank(items, "brandanda.com", "/halaman-lain")).toBeNull();
  });

  it("returns null when domain absent", () => {
    expect(findDomainRank(items, "tidakada.com")).toBeNull();
  });
});

describe("extractSerpFeatures", () => {
  it("collects distinct tracked feature types, excluding organic", () => {
    const features = extractSerpFeatures(items);
    expect(features).toContain("featured_snippet");
    expect(features).toContain("people_also_ask");
    expect(features).not.toContain("organic");
  });
});

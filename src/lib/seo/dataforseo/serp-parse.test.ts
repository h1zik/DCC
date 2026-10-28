import { describe, expect, it } from "vitest";
import {
  extractSerpFeatures,
  findDomainRank,
  normalizeDomain,
  normalizeUrlTarget,
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
    expect(result?.viaFeaturedSnippet).toBe(false);
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

describe("normalizeUrlTarget", () => {
  it("strips scheme, www, query/hash and trailing slash", () => {
    expect(
      normalizeUrlTarget("HTTPS://www.Brand.com/Produk/Serum/?utm=x#top"),
    ).toEqual({ host: "brand.com", path: "/produk/serum" });
    expect(normalizeUrlTarget("https://brand.com/")).toEqual({
      host: "brand.com",
      path: "",
    });
  });

  it("treats leading-slash and dot-less inputs as path-only", () => {
    expect(normalizeUrlTarget("/produk/serum/")).toEqual({
      host: null,
      path: "/produk/serum",
    });
    expect(normalizeUrlTarget("produk/serum")).toEqual({
      host: null,
      path: "/produk/serum",
    });
    expect(normalizeUrlTarget("   ")).toBeNull();
  });
});

describe("findDomainRank targetUrl matching", () => {
  const serp: SerpResultItem[] = [
    {
      type: "organic",
      rank_group: 1,
      domain: "brand.com",
      url: "https://brand.com/produk-baru",
    },
    {
      type: "organic",
      rank_group: 2,
      domain: "www.brand.com",
      url: "https://www.brand.com/produk/serum/?ref=serp",
    },
    {
      type: "organic",
      rank_group: 3,
      domain: "brand.com",
      url: "https://brand.com/produk/serum/varian-a",
    },
  ];

  it("matches a full target URL by host+path exactly (ignoring www/query/slash)", () => {
    const r = findDomainRank(serp, "brand.com", "http://www.brand.com/produk/serum/");
    expect(r?.position).toBe(2);
    expect(r?.viaFeaturedSnippet).toBe(false);
    // Host+path harus persis: path lain tidak cocok untuk target URL penuh.
    expect(
      findDomainRank(serp, "brand.com", "https://brand.com/produk/serum/varian-b"),
    ).toBeNull();
  });

  it("matches a path-only target exactly or as a prefix followed by '/'", () => {
    expect(findDomainRank(serp, "brand.com", "/produk/serum")?.position).toBe(2);
    expect(
      findDomainRank(serp, "brand.com", "/produk/serum/varian-a")?.position,
    ).toBe(3);
    // "/produk" adalah prefix "/produk/serum" (diikuti "/"), bukan "/produk-baru".
    expect(findDomainRank(serp, "brand.com", "/produk")?.position).toBe(2);
    // Tidak ada substring matching telanjang.
    expect(findDomainRank(serp, "brand.com", "/serum")).toBeNull();
    expect(findDomainRank(serp, "brand.com", "/produ")).toBeNull();
  });
});

describe("findDomainRank featured snippet fallback", () => {
  const serp: SerpResultItem[] = [
    {
      type: "featured_snippet",
      rank_group: 1,
      rank_absolute: 1,
      domain: "brand.com",
      url: "https://brand.com/blog/cara-pakai-serum",
    },
    {
      type: "organic",
      rank_group: 1,
      rank_absolute: 2,
      domain: "kompetitor.co.id",
      url: "https://kompetitor.co.id/a",
    },
  ];

  it("uses the featured snippet position when no organic result matches", () => {
    expect(findDomainRank(serp, "brand.com")).toEqual({
      position: 1,
      foundUrl: "https://brand.com/blog/cara-pakai-serum",
      viaFeaturedSnippet: true,
    });
  });

  it("prefers an organic match over the featured snippet", () => {
    const withOrganic: SerpResultItem[] = [
      ...serp,
      {
        type: "organic",
        rank_group: 4,
        domain: "brand.com",
        url: "https://brand.com/blog/cara-pakai-serum",
      },
    ];
    const r = findDomainRank(withOrganic, "brand.com");
    expect(r?.position).toBe(4);
    expect(r?.viaFeaturedSnippet).toBe(false);
  });

  it("applies the targetUrl rule to featured snippets too", () => {
    expect(findDomainRank(serp, "brand.com", "/produk")).toBeNull();
    expect(findDomainRank(serp, "brand.com", "/blog")?.viaFeaturedSnippet).toBe(
      true,
    );
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

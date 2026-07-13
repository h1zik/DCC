import { describe, expect, it } from "vitest";
import { suggestInternalLinks } from "@/lib/seo/content/internal-links";

const CANDIDATES = [
  { url: "https://brand.com/blog/serum-niacinamide-terbaik", keyword: "serum niacinamide" },
  { url: "https://brand.com/blog/tips-makeup-natural", keyword: "makeup natural" },
  { url: "https://brand.com/produk/moisturizer-kulit-berminyak", keyword: "moisturizer kulit berminyak" },
  { url: "https://brand.com/blog/serum-niacinamide-terbaik", keyword: "serum niacinamide" }, // duplikat
];

describe("suggestInternalLinks", () => {
  it("suggests relevant pages, dedupes, and ranks by overlap", () => {
    const out = suggestInternalLinks({
      targetKeyword: "serum niacinamide untuk kulit berminyak",
      relatedKeywords: ["niacinamide kulit berminyak"],
      terms: ["moisturizer"],
      candidates: CANDIDATES,
    });
    expect(out.map((o) => o.url)).toContain(
      "https://brand.com/blog/serum-niacinamide-terbaik",
    );
    expect(out.map((o) => o.url)).toContain(
      "https://brand.com/produk/moisturizer-kulit-berminyak",
    );
    // Halaman tidak relevan tidak ikut.
    expect(out.map((o) => o.url)).not.toContain(
      "https://brand.com/blog/tips-makeup-natural",
    );
    // Dedupe.
    expect(new Set(out.map((o) => o.url)).size).toBe(out.length);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      url: `https://brand.com/blog/serum-niacinamide-${i}`,
      keyword: "serum niacinamide",
    }));
    const out = suggestInternalLinks({
      targetKeyword: "serum niacinamide",
      relatedKeywords: [],
      terms: [],
      candidates: many,
      limit: 3,
    });
    expect(out).toHaveLength(3);
  });

  it("returns empty when nothing matches", () => {
    const out = suggestInternalLinks({
      targetKeyword: "serum niacinamide",
      relatedKeywords: [],
      terms: [],
      candidates: [{ url: "https://brand.com/tentang-kami", keyword: null }],
    });
    expect(out).toEqual([]);
  });
});

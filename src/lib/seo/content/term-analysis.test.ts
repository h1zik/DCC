import { describe, expect, it } from "vitest";
import {
  analyzeTerms,
  buildNgrams,
  medianTargets,
  tokenizeId,
} from "@/lib/seo/content/term-analysis";

describe("tokenizeId", () => {
  it("lowercases, strips punctuation and pure numbers", () => {
    expect(tokenizeId("Serum Niacinamide 10% terbaik, 2026!")).toEqual([
      "serum",
      "niacinamide",
      "terbaik",
    ]);
  });

  it("keeps hyphenated words without edge hyphens", () => {
    expect(tokenizeId("anti-aging -promo-")).toEqual(["anti-aging", "promo"]);
  });
});

describe("buildNgrams", () => {
  it("skips ngrams that start/end with stopwords but allows middle stopword in trigram", () => {
    const tokens = tokenizeId("serum untuk kulit kusam dan glowing");
    const grams = buildNgrams(tokens);
    expect(grams.has("serum")).toBe(true);
    expect(grams.has("untuk")).toBe(false);
    expect(grams.has("serum untuk")).toBe(false);
    expect(grams.has("serum untuk kulit")).toBe(true);
    expect(grams.has("kulit kusam")).toBe(true);
  });
});

const DOCS = [
  "Niacinamide membantu mencerahkan kulit kusam. Serum niacinamide cocok untuk kulit berminyak. Gunakan sunscreen setiap pagi. Skin barrier tetap terjaga.",
  "Serum niacinamide terbaik membantu kulit kusam tampak cerah. Kulit berminyak butuh niacinamide dan sunscreen. Jaga skin barrier.",
  "Untuk kulit kusam, niacinamide adalah pilihan tepat. Kulit berminyak juga cocok. Pakai sunscreen agar hasil maksimal.",
];

describe("analyzeTerms", () => {
  it("finds shared semantic terms across docs with sane targets", () => {
    const terms = analyzeTerms(DOCS, { targetKeyword: "serum niacinamide" });
    const names = terms.map((t) => t.term);
    expect(names).toContain("kulit kusam");
    expect(names).toContain("kulit berminyak");
    expect(names).toContain("sunscreen");
    // Term = substring keyword target harus dibuang.
    expect(names).not.toContain("serum");
    expect(names).not.toContain("niacinamide");
    for (const t of terms) {
      expect(t.targetMin).toBeGreaterThanOrEqual(1);
      expect(t.targetMax).toBeGreaterThanOrEqual(t.targetMin);
      expect(t.docCount).toBeGreaterThanOrEqual(2);
    }
  });

  it("returns empty for no docs", () => {
    expect(analyzeTerms([])).toEqual([]);
  });

  it("respects the limit", () => {
    expect(analyzeTerms(DOCS, { limit: 3 })).toHaveLength(3);
  });
});

describe("medianTargets", () => {
  it("uses median * 1.1 clamped to 1200..3000", () => {
    const t = medianTargets([
      { wordCount: 800, headingsCount: 4 },
      { wordCount: 1000, headingsCount: 6 },
      { wordCount: 3000, headingsCount: 8 },
    ]);
    expect(t.targetWordCount).toBe(1200); // 1000*1.1=1100 → clamp 1200
    expect(t.targetHeadings).toBe(6);
  });

  it("clamps very long competitors to 3000", () => {
    const t = medianTargets([
      { wordCount: 5000, headingsCount: 12 },
      { wordCount: 6000, headingsCount: 14 },
    ]);
    expect(t.targetWordCount).toBe(3000);
  });

  it("handles empty input", () => {
    const t = medianTargets([]);
    expect(t.targetWordCount).toBe(1200);
    expect(t.targetHeadings).toBe(3);
  });
});

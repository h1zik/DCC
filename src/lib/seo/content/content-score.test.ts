import { describe, expect, it } from "vitest";
import {
  analyzeContent,
  type ContentAnalysisInput,
} from "@/lib/seo/content/content-score";

function input(overrides: Partial<ContentAnalysisInput> = {}): ContentAnalysisInput {
  return {
    wordCount: 800,
    keyword: "serum vitamin c",
    keywordCount: 8,
    keywordInTitle: true,
    keywordInFirstParagraph: true,
    h1Count: 1,
    h2Count: 3,
    avgWordsPerSentence: 16,
    ...overrides,
  };
}

describe("analyzeContent", () => {
  it("scores a well-optimized draft at 100", () => {
    const result = analyzeContent(input());
    expect(result.score).toBe(100);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it("computes keyword density", () => {
    const result = analyzeContent(input({ wordCount: 1000, keywordCount: 10 }));
    expect(result.density).toBeCloseTo(0.01, 5);
  });

  it("fails density check on keyword stuffing", () => {
    const result = analyzeContent(input({ wordCount: 100, keywordCount: 10 }));
    const density = result.checks.find((c) => c.id === "density");
    expect(density?.passed).toBe(false);
  });

  it("penalizes thin content and missing structure", () => {
    const result = analyzeContent(
      input({ wordCount: 200, h1Count: 0, h2Count: 0, avgWordsPerSentence: 35 }),
    );
    expect(result.score).toBeLessThan(60);
    expect(result.checks.find((c) => c.id === "word_count")?.passed).toBe(false);
    expect(result.checks.find((c) => c.id === "has_h2")?.passed).toBe(false);
  });

  it("skips keyword checks when no keyword provided", () => {
    const result = analyzeContent(input({ keyword: null, keywordCount: 0 }));
    const ids = result.checks.map((c) => c.id);
    expect(ids).not.toContain("keyword_in_title");
    expect(ids).not.toContain("density");
  });
});

import { describe, expect, it } from "vitest";
import { computeKoiForKeyword } from "@/lib/research/keyword-intel/compute-koi";
import type { NormalizedKeywordSignal } from "@/lib/research/keyword-intel/keyword-signal-types";

function signal(
  partial: Partial<NormalizedKeywordSignal> & Pick<NormalizedKeywordSignal, "source" | "keyword">,
): NormalizedKeywordSignal {
  return {
    signalId: `${partial.source}:${partial.keyword}:test`,
    metric: "test",
    value: partial.value ?? 1,
    ...partial,
  };
}

describe("computeKoiForKeyword", () => {
  it("scores higher volume keywords higher", () => {
    const low = computeKoiForKeyword({
      keyword: "serum wajah",
      signals: [
        signal({ source: "dataforseo", keyword: "serum wajah", volume: 100, value: 100 }),
      ],
    });
    const high = computeKoiForKeyword({
      keyword: "serum wajah",
      signals: [
        signal({ source: "dataforseo", keyword: "serum wajah", volume: 50000, value: 50000 }),
      ],
    });
    expect(high.koiScore).toBeGreaterThan(low.koiScore);
  });

  it("treats low listing sample count as higher opportunity", () => {
    const sparse = computeKoiForKeyword({
      keyword: "deodorant natural",
      signals: [
        signal({
          source: "shopee_search",
          keyword: "deodorant natural",
          listingSampleCount: 3,
          volume: 1000,
          value: 3,
        }),
      ],
    });
    const saturated = computeKoiForKeyword({
      keyword: "deodorant natural",
      signals: [
        signal({
          source: "shopee_search",
          keyword: "deodorant natural",
          listingSampleCount: 24,
          volume: 1000,
          value: 24,
        }),
      ],
    });
    expect(sparse.koiScore).toBeGreaterThan(saturated.koiScore);
  });

  it("assigns HIGH confidence with 3+ source families and numeric data", () => {
    const result = computeKoiForKeyword({
      keyword: "body serum",
      signals: [
        signal({ source: "dataforseo", keyword: "body serum", volume: 8000, value: 8000 }),
        signal({ source: "shopee_autocomplete", keyword: "body serum", value: 12 }),
        signal({ source: "review_intel", keyword: "body serum", value: 15 }),
      ],
    });
    expect(result.confidence).toBe("HIGH");
  });
});

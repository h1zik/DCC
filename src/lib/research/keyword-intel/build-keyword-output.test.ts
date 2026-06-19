import { describe, expect, it } from "vitest";
import {
  buildGapKeywordsFromMatrix,
  buildKeywordMatrixFromSignals,
} from "@/lib/research/keyword-intel/build-keyword-output";
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

describe("buildGapKeywordsFromMatrix", () => {
  it("requires at least two source families when volume data is missing", () => {
    const allSignals: NormalizedKeywordSignal[] = [
      signal({ source: "shopee_autocomplete", keyword: "serum glowing", value: 80 }),
      signal({ source: "competitor", keyword: "serum glowing", value: 50 }),
      signal({ source: "review_intel", keyword: "serum glowing", value: 40, trend: "up" }),
      signal({
        source: "shopee_search",
        keyword: "serum glowing",
        listingSampleCount: 4,
        value: 4,
      }),
    ];
    const matrix = buildKeywordMatrixFromSignals(allSignals, new Map(), {
      allSignals,
    });
    const gaps = buildGapKeywordsFromMatrix(matrix, allSignals);
    expect(gaps.some((g) => g.keyword === "serum glowing")).toBe(true);
  });

  it("excludes gaps with only one source family and no volume", () => {
    const allSignals: NormalizedKeywordSignal[] = [
      signal({ source: "shopee_autocomplete", keyword: "lone keyword", value: 8 }),
    ];
    const matrix = buildKeywordMatrixFromSignals(allSignals, new Map(), {
      allSignals,
    });
    const gaps = buildGapKeywordsFromMatrix(matrix, allSignals);
    expect(gaps.some((g) => g.keyword === "lone keyword")).toBe(false);
  });

  it("includes high-volume low-competition keywords with volume data", () => {
    const allSignals: NormalizedKeywordSignal[] = [
      signal({
        source: "dataforseo",
        keyword: "vitamin c serum",
        volume: 12000,
        competition: 0.3,
        value: 12000,
        listingSampleCount: 6,
      }),
      signal({ source: "google_trends_rising", keyword: "vitamin c serum", trend: "up", value: 50 }),
    ];
    const matrix = buildKeywordMatrixFromSignals(allSignals, new Map(), {
      allSignals,
    });
    const gaps = buildGapKeywordsFromMatrix(matrix, allSignals);
    expect(gaps.some((g) => g.keyword === "vitamin c serum")).toBe(true);
  });
});

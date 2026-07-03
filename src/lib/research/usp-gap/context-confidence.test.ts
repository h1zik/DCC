import { describe, expect, it } from "vitest";
import {
  applyDataConfidenceCap,
  confidenceCapForModuleCount,
  countContextModulesWithData,
} from "./context-confidence";
import type { UspGatheredContext } from "./gather-context";

function ctxWith(partial: Partial<UspGatheredContext>): UspGatheredContext {
  return {
    category: "serum",
    reviewIntel: null,
    competitor: null,
    trendRadar: null,
    keywordIntel: null,
    socialListening: null,
    ...partial,
  } as UspGatheredContext;
}

describe("confidenceCapForModuleCount", () => {
  it("membatasi keras saat data minim", () => {
    expect(confidenceCapForModuleCount(0)).toBe(0.4);
    expect(confidenceCapForModuleCount(1)).toBe(0.4);
    expect(confidenceCapForModuleCount(2)).toBe(0.55);
    expect(confidenceCapForModuleCount(3)).toBe(0.7);
    expect(confidenceCapForModuleCount(4)).toBe(0.85);
    expect(confidenceCapForModuleCount(7)).toBe(0.95);
  });
});

describe("countContextModulesWithData", () => {
  it("menghitung hanya modul yang benar-benar berisi data", () => {
    expect(countContextModulesWithData(ctxWith({}))).toBe(0);
    expect(
      countContextModulesWithData(
        ctxWith({
          trendRadar: { items: [] } as unknown as UspGatheredContext["trendRadar"],
        }),
      ),
    ).toBe(0);
  });
});

describe("applyDataConfidenceCap", () => {
  it("menurunkan confidence LLM yang melebihi cap data", () => {
    const result = applyDataConfidenceCap(0.9, ctxWith({}));
    expect(result.confidence).toBe(0.4);
    expect(result.capped).toBe(true);
    expect(result.moduleCount).toBe(0);
  });

  it("membiarkan confidence yang sudah di bawah cap", () => {
    const result = applyDataConfidenceCap(0.3, ctxWith({}));
    expect(result.confidence).toBe(0.3);
    expect(result.capped).toBe(false);
  });
});

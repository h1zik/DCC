import { describe, expect, it } from "vitest";
import { TrendWowStatus } from "@prisma/client";
import {
  applyWowDiff,
  goneTrendNames,
  type PriorTrendItem,
} from "@/lib/research/trend-radar/compute-wow-diff";
import type { ClusteredTrend } from "@/lib/research/trend-radar/trend-signal-types";

function item(
  name: string,
  tmiScore: number,
  wowStatus?: TrendWowStatus,
): ClusteredTrend {
  return {
    name,
    dimension: "INGREDIENT",
    phase: "GROWING",
    phaseSource: "computed",
    tmiScore,
    confidence: "MED",
    isGlobalPipeline: false,
    evidence: [],
    relatedProducts: [],
    wowStatus,
  };
}

describe("applyWowDiff", () => {
  const prior: PriorTrendItem[] = [
    { name: "Niacinamide Brightening", tmiScore: 0.5 },
    { name: "Retinol Anti Aging", tmiScore: 0.7 },
  ];

  it("marks unmatched trends as NEW", () => {
    const current = [item("Sunscreen SPF 50", 0.6)];
    const result = applyWowDiff(current, prior);
    expect(result[0]!.wowStatus).toBe(TrendWowStatus.NEW);
  });

  it("marks accelerating when TMI delta exceeds 10%", () => {
    const current = [item("Niacinamide Brightening Serum", 0.65)];
    const result = applyWowDiff(current, prior);
    expect(result[0]!.wowStatus).toBe(TrendWowStatus.ACCELERATING);
  });

  it("marks fading when TMI drops more than 10%", () => {
    const current = [item("Retinol Anti Aging Cream", 0.55)];
    const result = applyWowDiff(current, prior);
    expect(result[0]!.wowStatus).toBe(TrendWowStatus.FADING);
  });

  it("marks stable when delta is within threshold", () => {
    const current = [item("Retinol Anti Aging", 0.72)];
    const result = applyWowDiff(current, prior);
    expect(result[0]!.wowStatus).toBe(TrendWowStatus.STABLE);
  });
});

describe("goneTrendNames", () => {
  it("returns prior trends absent from current digest", () => {
    const current = [item("Niacinamide", 0.6)];
    const prior: PriorTrendItem[] = [
      { name: "Niacinamide", tmiScore: 0.5 },
      { name: "Retinol", tmiScore: 0.7 },
    ];
    expect(goneTrendNames(current, prior)).toEqual(["Retinol"]);
  });
});

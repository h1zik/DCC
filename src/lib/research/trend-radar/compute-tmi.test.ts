import { describe, expect, it } from "vitest";
import { TrendPhase } from "@prisma/client";
import type { TrendClusterWithDimension } from "@/lib/research/trend-radar/cluster-trends";
import { computeClusteredTrends } from "@/lib/research/trend-radar/compute-tmi";
import type { NormalizedTrendSignal } from "@/lib/research/trend-radar/trend-signal-types";

function signal(
  partial: Partial<NormalizedTrendSignal> & Pick<NormalizedTrendSignal, "source" | "term">,
): NormalizedTrendSignal {
  return {
    signalId: partial.signalId ?? `${partial.source}-${partial.term}`,
    metric: partial.metric ?? "count",
    value: partial.value ?? 100,
    deltaPct: partial.deltaPct,
    meta: partial.meta,
    ...partial,
  };
}

function cluster(
  name: string,
  signals: NormalizedTrendSignal[],
  families: string[],
): TrendClusterWithDimension {
  return {
    key: name,
    name,
    signals,
    evidence: signals.map((s) => ({
      signalId: s.signalId,
      source: s.source,
      term: s.term,
      metric: s.metric,
      value: s.value,
      deltaPct: s.deltaPct,
    })),
    sourceFamilies: new Set(families),
    isGlobalPipeline: false,
    dimension: "INGREDIENT",
  };
}

describe("computeClusteredTrends phase assignment", () => {
  it("assigns EMERGING when rising with low market density", () => {
    const c = cluster(
      "niacinamide serum",
      [
        signal({
          source: "google_trends",
          term: "niacinamide",
          metric: "rising_query",
          value: 80,
          deltaPct: 25,
          meta: { rising: true },
        }),
      ],
      ["google_trends"],
    );
    const [trend] = computeClusteredTrends({
      clusters: [c],
      digestModePartial: false,
    });
    expect(trend.phase).toBe(TrendPhase.EMERGING);
  });

  it("assigns DECLINING on negative velocity", () => {
    const c = cluster(
      "retinol cream",
      [
        signal({
          source: "keyword_intel",
          term: "retinol",
          metric: "interest_down",
          value: 40,
          deltaPct: -20,
          meta: { trend: "down" },
        }),
      ],
      ["keyword_intel"],
    );
    const [trend] = computeClusteredTrends({
      clusters: [c],
      digestModePartial: false,
    });
    expect(trend.phase).toBe(TrendPhase.DECLINING);
  });

  it("caps confidence to LOW in partial digest mode", () => {
    const c = cluster(
      "ceramide barrier",
      [
        signal({ source: "google_trends", term: "ceramide", value: 500 }),
        signal({ source: "tiktok", term: "ceramide", value: 10000 }),
        signal({ source: "review_intel", term: "ceramide", value: 50 }),
      ],
      ["google_trends", "tiktok", "review_intel"],
    );
    const [trend] = computeClusteredTrends({
      clusters: [c],
      digestModePartial: true,
    });
    expect(trend.confidence).toBe("LOW");
  });
});

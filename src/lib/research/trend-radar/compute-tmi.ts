import "server-only";

import { TrendDimension, TrendPhase, TrendConfidence } from "@prisma/client";
import type { TrendClusterWithDimension } from "@/lib/research/trend-radar/cluster-trends";
import type { ClusteredTrend } from "@/lib/research/trend-radar/trend-signal-types";
import { clampTrendScore } from "@/lib/research/trend-radar/normalize-trend";

const WEIGHTS = {
  search: 0.3,
  social: 0.25,
  market: 0.25,
  consumer: 0.2,
} as const;

function familyScore(
  cluster: TrendClusterWithDimension,
  families: string[],
  metricFilter?: (metric: string) => boolean,
): number {
  const vals = cluster.signals
    .filter((s) => families.includes(s.source))
    .filter((s) => (metricFilter ? metricFilter(s.metric) : true))
    .map((s) => Math.abs(s.value));

  if (vals.length === 0) return 0;
  const max = Math.max(...vals);
  return Math.min(1, Math.log10(max + 1) / 4);
}

function velocityFromDeltas(cluster: TrendClusterWithDimension): number {
  const deltas = cluster.signals
    .map((s) => s.deltaPct)
    .filter((d): d is number => d != null && Number.isFinite(d));
  if (deltas.length === 0) return 0;
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return Math.max(-1, Math.min(1, avg / 100));
}

function computeConfidence(
  cluster: TrendClusterWithDimension,
  digestModePartial: boolean,
): TrendConfidence {
  const families = cluster.sourceFamilies.size;
  const hasNumeric = cluster.signals.some(
    (s) => s.value > 0 && s.metric !== "headline",
  );

  if (digestModePartial) return TrendConfidence.LOW;
  if (families >= 3 && hasNumeric) return TrendConfidence.HIGH;
  if (families >= 2) return TrendConfidence.MED;
  if (cluster.signals.every((s) => s.source === "rss")) return TrendConfidence.LOW;
  return TrendConfidence.LOW;
}

function inferPhase(
  cluster: TrendClusterWithDimension,
  tmiScore: number,
): TrendPhase {
  const velocity = velocityFromDeltas(cluster);
  const marketDensity = familyScore(cluster, ["competitor"], () => true);
  const rising = cluster.signals.some(
    (s) =>
      s.meta?.rising === true ||
      s.meta?.trend === "up" ||
      s.metric === "rising_query" ||
      (s.deltaPct != null && s.deltaPct > 15),
  );
  const declining = cluster.signals.some(
    (s) =>
      s.meta?.trend === "down" ||
      s.metric === "interest_down" ||
      (s.deltaPct != null && s.deltaPct < -10),
  );

  if (declining && velocity < 0) return TrendPhase.DECLINING;
  if (rising && marketDensity < 0.35) return TrendPhase.EMERGING;
  if (marketDensity >= 0.65 && (velocity <= 0.05 || tmiScore >= 0.7)) {
    return TrendPhase.PEAK;
  }
  if (velocity > 0.05 || rising) return TrendPhase.GROWING;
  if (tmiScore >= 0.55) return TrendPhase.GROWING;
  return TrendPhase.GROWING;
}

export function computeClusteredTrends(input: {
  clusters: TrendClusterWithDimension[];
  digestModePartial: boolean;
}): ClusteredTrend[] {
  return input.clusters.map((cluster) => {
    const searchScore =
      familyScore(cluster, ["google_trends", "keyword_intel"]) +
      (cluster.signals.some((s) => s.metric === "interest_over_time" && s.value > 0)
        ? 0.15
        : 0);
    const socialScore = familyScore(cluster, ["tiktok", "social_listening"]);
    const marketScore = familyScore(cluster, ["competitor", "bpom"]);
    const consumerScore = familyScore(cluster, ["review_intel"]);

    const rawTmi =
      Math.min(1, searchScore) * WEIGHTS.search +
      Math.min(1, socialScore) * WEIGHTS.social +
      Math.min(1, marketScore) * WEIGHTS.market +
      Math.min(1, consumerScore) * WEIGHTS.consumer;

    const velocityBoost = velocityFromDeltas(cluster) * 0.1;
    const tmiScore = clampTrendScore(rawTmi + velocityBoost);
    const confidence = computeConfidence(cluster, input.digestModePartial);

    return {
      name: cluster.name.slice(0, 200),
      dimension: cluster.dimension,
      phase: inferPhase(cluster, tmiScore),
      phaseSource: "computed" as const,
      tmiScore,
      confidence,
      isGlobalPipeline: cluster.isGlobalPipeline,
      evidence: cluster.evidence,
      relatedProducts: [],
    };
  });
}

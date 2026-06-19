import "server-only";

import { TrendDimension } from "@prisma/client";
import type {
  NormalizedTrendSignal,
  TrendEvidenceRow,
} from "@/lib/research/trend-radar/trend-signal-types";

export type TrendClusterWithDimension = {
  key: string;
  name: string;
  signals: NormalizedTrendSignal[];
  evidence: TrendEvidenceRow[];
  sourceFamilies: Set<string>;
  isGlobalPipeline: boolean;
  dimension: TrendDimension;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function overlapScore(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) {
    if (tb.has(t)) inter += 1;
  }
  return inter / Math.min(ta.size, tb.size);
}

function toEvidence(s: NormalizedTrendSignal): TrendEvidenceRow {
  return {
    signalId: s.signalId,
    source: s.source,
    term: s.term,
    metric: s.metric,
    value: s.value,
    deltaPct: s.deltaPct,
    url: s.url,
    moduleHref: s.moduleHref,
  };
}

function inferDimension(signals: NormalizedTrendSignal[]): TrendDimension {
  const text = signals.map((s) => s.term).join(" ").toLowerCase();
  if (/\b(serum|cream|lotion|toner|mask|spf|sunscreen)\b/.test(text)) {
    return TrendDimension.FORMAT;
  }
  if (/\b(niacinamide|ceramide|retinol|vitamin|acid|exosome|peptide)\b/.test(text)) {
    return TrendDimension.INGREDIENT;
  }
  if (/\b(brightening|whitening|barrier|anti.?aging|glow|acne)\b/.test(text)) {
    return TrendDimension.CLAIM;
  }
  if (signals.some((s) => s.source === "rss")) {
    return TrendDimension.CATEGORY;
  }
  return TrendDimension.CLAIM;
}

function clusterName(signals: NormalizedTrendSignal[]): string {
  const sorted = [...signals].sort((a, b) => b.value - a.value);
  const primary = sorted[0]?.term ?? "Unknown trend";
  if (primary.length <= 48) return primary;
  return `${primary.slice(0, 45)}…`;
}

function appendEvidence(
  cluster: TrendClusterWithDimension,
  signal: NormalizedTrendSignal,
): void {
  if (cluster.evidence.some((e) => e.signalId === signal.signalId)) return;
  cluster.evidence.push(toEvidence(signal));
}

export function clusterTrendSignals(
  signals: NormalizedTrendSignal[],
): TrendClusterWithDimension[] {
  const clusters: TrendClusterWithDimension[] = [];

  for (const signal of signals) {
    let best: TrendClusterWithDimension | null = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      const score = overlapScore(signal.term, cluster.name);
      if (score > bestScore && score >= 0.35) {
        bestScore = score;
        best = cluster;
      }
    }

    if (best) {
      best.signals.push(signal);
      appendEvidence(best, signal);
      best.sourceFamilies.add(signal.source);
      if (signal.source === "rss") best.isGlobalPipeline = true;
      best.name = clusterName(best.signals);
      best.dimension = inferDimension(best.signals);
    } else {
      clusters.push({
        key: signal.signalId,
        name: clusterName([signal]),
        signals: [signal],
        evidence: [toEvidence(signal)],
        sourceFamilies: new Set([signal.source]),
        isGlobalPipeline: signal.source === "rss",
        dimension: inferDimension([signal]),
      });
    }
  }

  return clusters
    .filter((c) => c.signals.length > 0)
    .sort((a, b) => {
      const av = a.signals.reduce((s, x) => s + Math.abs(x.value), 0);
      const bv = b.signals.reduce((s, x) => s + Math.abs(x.value), 0);
      return bv - av;
    })
    .slice(0, 15);
}

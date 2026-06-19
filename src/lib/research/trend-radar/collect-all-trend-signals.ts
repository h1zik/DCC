import "server-only";

import { collectExternalTrendSignals } from "@/lib/research/trend-radar/collect-sources";
import { collectInternalTrendSignals } from "@/lib/research/trend-radar/collect-internal-signals";
import type { TrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config-types";
import { getDefaultTrendSourceConfig } from "@/lib/research/trend-radar/trend-source-config";
import type {
  NormalizedTrendSignal,
  TrendSignalStats,
} from "@/lib/research/trend-radar/trend-signal-types";
import {
  dedupeTrendSignals,
  emptySignalStats,
} from "@/lib/research/trend-radar/trend-signal-types";

function countBySource(signals: NormalizedTrendSignal[]): TrendSignalStats {
  const stats = emptySignalStats();
  stats.collectedAt = new Date().toISOString();

  for (const s of signals) {
    switch (s.source) {
      case "google_trends":
        stats.external.googleTrends += 1;
        break;
      case "rss":
        stats.external.rss += 1;
        break;
      case "tiktok":
        stats.external.tiktok += 1;
        break;
      case "bpom":
        stats.external.bpom += 1;
        break;
      case "review_intel":
        stats.internal.reviewIntel += 1;
        break;
      case "competitor":
        stats.internal.competitor += 1;
        break;
      case "keyword_intel":
        stats.internal.keywordIntel += 1;
        break;
      case "social_listening":
        stats.internal.socialListening += 1;
        break;
    }
  }

  stats.total = signals.length;
  return stats;
}

export async function collectAllTrendSignals(input: {
  seedKeywords?: string[];
  sourceConfig?: TrendSourceConfig;
}): Promise<{ signals: NormalizedTrendSignal[]; signalStats: TrendSignalStats }> {
  const sourceConfig = input.sourceConfig ?? getDefaultTrendSourceConfig();
  const seeds = input.seedKeywords ?? [];

  const [external, internal] = await Promise.all([
    collectExternalTrendSignals(seeds, sourceConfig),
    collectInternalTrendSignals({
      reviewIntel: sourceConfig.enabled.reviewIntel,
      competitor: sourceConfig.enabled.competitor,
      keywordIntel: sourceConfig.enabled.keywordIntel,
      socialListening: sourceConfig.enabled.socialListening,
      seedKeywords: seeds,
    }),
  ]);

  const signals = dedupeTrendSignals([...external, ...internal]);
  return {
    signals,
    signalStats: countBySource(signals),
  };
}

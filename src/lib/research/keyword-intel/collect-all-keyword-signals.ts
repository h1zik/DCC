import "server-only";

import { ResearchMarketplace } from "@prisma/client";
import { collectCompetitorKeywordSignals } from "@/lib/research/keyword-intel/collect-competitor-keywords";
import { collectExternalKeywordSignals } from "@/lib/research/keyword-intel/collect-keywords";
import { collectInternalKeywordSignals } from "@/lib/research/keyword-intel/collect-internal-keyword-signals";
import type { KeywordSourceConfig } from "@/lib/research/keyword-intel/keyword-source-config-types";
import {
  emptyKeywordSignalStats,
  normKeyword,
  type KeywordSignalStats,
  type NormalizedKeywordSignal,
} from "@/lib/research/keyword-intel/keyword-signal-types";

function bumpStats(
  stats: KeywordSignalStats,
  signal: NormalizedKeywordSignal,
): void {
  const src = signal.source;
  if (src.includes("shopee") && !src.includes("search")) stats.external.shopee += 1;
  else if (src === "shopee_search") stats.external.shopeeSearch += 1;
  else if (src.includes("tokopedia")) stats.external.tokopedia += 1;
  else if (src.includes("google_trends")) stats.external.googleTrends += 1;
  else if (src === "dataforseo") stats.external.dataforseo += 1;
  else if (src === "competitor") stats.internal.competitor += 1;
  else if (src === "review_intel") stats.internal.reviewIntel += 1;
  else if (src === "social_listening") stats.internal.socialListening += 1;
}

function mergeSignals(signals: NormalizedKeywordSignal[]): NormalizedKeywordSignal[] {
  const map = new Map<string, NormalizedKeywordSignal>();

  for (const s of signals) {
    const key = normKeyword(s.keyword);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...s, keyword: s.keyword.trim() });
      continue;
    }
    if (s.volume != null && (existing.volume == null || s.volume > existing.volume)) {
      existing.volume = s.volume;
    }
    if (
      s.competition != null &&
      (existing.competition == null || s.competition < existing.competition)
    ) {
      existing.competition = s.competition;
    }
    if (s.trend && s.trend !== "stable") existing.trend = s.trend;
    if (s.listingSampleCount != null) {
      existing.listingSampleCount = s.listingSampleCount;
    }
    if (s.medianPrice != null) existing.medianPrice = s.medianPrice;
    if (s.moduleHref && !existing.moduleHref) existing.moduleHref = s.moduleHref;
  }

  return [...map.values()];
}

export async function collectAllKeywordSignals(input: {
  category: string;
  seedKeyword?: string | null;
  marketplace?: ResearchMarketplace | null;
  sourceConfig: KeywordSourceConfig;
}): Promise<{
  signals: NormalizedKeywordSignal[];
  signalStats: KeywordSignalStats;
  volumeKeywordCount: number;
  dataNotice: string | null;
}> {
  const stats = emptyKeywordSignalStats();
  const batches: NormalizedKeywordSignal[] = [];
  let dataNotice: string | null = null;

  if (input.sourceConfig.enabled.marketplaceAutocomplete || input.sourceConfig.enabled.googleTrends || input.sourceConfig.enabled.dataforseo) {
    const external = await collectExternalKeywordSignals({
      category: input.category,
      seedKeyword: input.seedKeyword,
      marketplace: input.marketplace,
      enabled: {
        marketplaceAutocomplete: input.sourceConfig.enabled.marketplaceAutocomplete,
        googleTrends: input.sourceConfig.enabled.googleTrends,
        dataforseo: input.sourceConfig.enabled.dataforseo,
      },
    });
    batches.push(...external.signals);
    if (external.dataNotice) dataNotice = external.dataNotice;
  }

  if (input.sourceConfig.enabled.competitor) {
    batches.push(
      ...(await collectCompetitorKeywordSignals({
        category: input.category,
        seedKeyword: input.seedKeyword,
      })),
    );
  }

  if (input.sourceConfig.enabled.reviewIntel || input.sourceConfig.enabled.socialListening) {
    batches.push(
      ...(await collectInternalKeywordSignals({
        category: input.category,
        seedKeyword: input.seedKeyword,
        reviewIntel: input.sourceConfig.enabled.reviewIntel,
        socialListening: input.sourceConfig.enabled.socialListening,
      })),
    );
  }

  const merged = mergeSignals(batches).slice(0, 80);

  for (const s of merged) {
    bumpStats(stats, s);
  }
  stats.total = merged.length;
  stats.collectedAt = new Date().toISOString();

  const volumeKeywordCount = merged.filter(
    (s) => s.source === "dataforseo" && s.volume != null && s.volume > 0,
  ).length;

  return {
    signals: merged,
    signalStats: stats,
    volumeKeywordCount,
    dataNotice,
  };
}

import "server-only";

import { ResearchMarketplace } from "@prisma/client";
import { fetchMarketplaceAutocomplete } from "@/lib/research/keyword-intel/marketplace-autocomplete";
import {
  fetchInterestTrend,
  fetchRelatedKeywords,
} from "@/lib/research/keyword-intel/google-trends-keywords";
import {
  fetchKeywordVolumes,
  isKeywordsEverywhereConfigured,
} from "@/lib/research/keyword-intel/keywords-everywhere";
import { generateDemoKeywordSignals } from "@/lib/research/keyword-intel/demo-keywords";

export type RawKeywordSignal = {
  keyword: string;
  sources: string[];
  volume?: number;
  competition?: number;
  trend?: "up" | "down" | "stable";
};

function mergeSignals(signals: RawKeywordSignal[]): RawKeywordSignal[] {
  const map = new Map<string, RawKeywordSignal>();

  for (const s of signals) {
    const key = s.keyword.trim().toLowerCase();
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...s, keyword: s.keyword.trim(), sources: [...s.sources] });
      continue;
    }
    existing.sources = [...new Set([...existing.sources, ...s.sources])];
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
  }

  return [...map.values()];
}

export async function collectKeywordSignals(input: {
  category: string;
  seedKeyword?: string | null;
  marketplace?: ResearchMarketplace | null;
}): Promise<RawKeywordSignal[]> {
  const seed = (input.seedKeyword?.trim() || input.category).trim();
  const signals: RawKeywordSignal[] = [];

  const [autoHits, related] = await Promise.all([
    fetchMarketplaceAutocomplete(seed, input.marketplace),
    fetchRelatedKeywords(seed),
  ]);

  for (const hit of autoHits) {
    signals.push({ keyword: hit.keyword, sources: [hit.source] });
  }

  for (const r of related) {
    signals.push({
      keyword: r.keyword,
      sources: [
        r.type === "rising" ? "google_trends_rising" : "google_trends_top",
      ],
      trend: r.type === "rising" ? "up" : undefined,
    });
  }

  let merged = mergeSignals(signals);

  if (isKeywordsEverywhereConfigured() && merged.length > 0) {
    const volumes = await fetchKeywordVolumes(merged.map((m) => m.keyword));
    const volMap = new Map(
      volumes.map((v) => [v.keyword.toLowerCase(), v]),
    );
    merged = merged.map((m) => {
      const ke = volMap.get(m.keyword.toLowerCase());
      if (!ke) return m;
      return {
        ...m,
        volume: ke.vol,
        competition: ke.competition,
        sources: [...m.sources, "keywords_everywhere"],
      };
    });
  }

  const needTrend = merged.filter((m) => !m.trend).slice(0, 5);
  for (const m of needTrend) {
    m.trend = await fetchInterestTrend(m.keyword);
  }

  if (merged.length === 0) {
    return generateDemoKeywordSignals(input.category);
  }

  if (!isKeywordsEverywhereConfigured()) {
    merged = merged.map((m, i) => ({
      ...m,
      volume: m.volume ?? Math.max(500, 12000 - i * 800),
      competition: m.competition ?? Math.min(0.95, 0.3 + (i % 7) * 0.08),
      trend: m.trend ?? (i % 3 === 0 ? "up" : "stable"),
    }));
  }

  return merged.slice(0, 80);
}

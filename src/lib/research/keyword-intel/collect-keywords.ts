import "server-only";

import { ResearchMarketplace } from "@prisma/client";
import { fetchMarketplaceAutocomplete } from "@/lib/research/keyword-intel/marketplace-autocomplete";
import {
  fetchInterestTrend,
  fetchRelatedKeywords,
} from "@/lib/research/keyword-intel/google-trends-keywords";
import {
  fetchKeywordVolumesFromDataForSeo,
  getDataForSeoMaxKeywords,
  isDataForSeoConfigured,
} from "@/lib/research/keyword-intel/dataforseo-keywords";
import {
  signalId,
  type NormalizedKeywordSignal,
} from "@/lib/research/keyword-intel/keyword-signal-types";

export type CollectExternalKeywordResult = {
  signals: NormalizedKeywordSignal[];
  dataNotice: string | null;
};

function mergeBatch(signals: NormalizedKeywordSignal[]): NormalizedKeywordSignal[] {
  const map = new Map<string, NormalizedKeywordSignal>();

  for (const s of signals) {
    const key = s.keyword.trim().toLowerCase();
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
  }

  return [...map.values()];
}

export async function collectExternalKeywordSignals(input: {
  category: string;
  seedKeyword?: string | null;
  marketplace?: ResearchMarketplace | null;
  enabled: {
    marketplaceAutocomplete: boolean;
    googleTrends: boolean;
    dataforseo: boolean;
  };
}): Promise<CollectExternalKeywordResult> {
  const seed = (input.seedKeyword?.trim() || input.category).trim();
  const signals: NormalizedKeywordSignal[] = [];
  let dataNotice: string | null = null;

  if (input.enabled.marketplaceAutocomplete) {
    const autoHits = await fetchMarketplaceAutocomplete(seed);
    for (const hit of autoHits) {
      signals.push({
        signalId: signalId(hit.source, hit.keyword, "autocomplete"),
        source: hit.source,
        keyword: hit.keyword,
        metric: "autocomplete",
        value: 1,
      });
    }
  }

  if (input.enabled.googleTrends) {
    const related = await fetchRelatedKeywords(seed);
    for (const r of related) {
      signals.push({
        signalId: signalId(
          r.type === "rising" ? "google_trends_rising" : "google_trends_top",
          r.keyword,
          "related_query",
        ),
        source: r.type === "rising" ? "google_trends_rising" : "google_trends_top",
        keyword: r.keyword,
        metric: "related_query",
        value: r.value,
        trend: r.type === "rising" ? "up" : undefined,
      });
    }
  }

  let merged = mergeBatch(signals);

  if (input.enabled.dataforseo && isDataForSeoConfigured() && merged.length > 0) {
    const forVolume = merged.slice(0, getDataForSeoMaxKeywords()).map((m) => m.keyword);
    const dfsResult = await fetchKeywordVolumesFromDataForSeo(forVolume);

    if (dfsResult.balanceExhausted) {
      dataNotice =
        "Saldo DataForSEO habis — volume Google tidak diisi. Top-up saldo di app.dataforseo.com.";
    } else if (dfsResult.errorMessage && dfsResult.data.length === 0) {
      dataNotice = `DataForSEO: ${dfsResult.errorMessage}`;
    } else if (dfsResult.data.length > 0) {
      const volMap = new Map(
        dfsResult.data.map((v) => [v.keyword.toLowerCase(), v]),
      );
      merged = merged.map((m) => {
        const dfs = volMap.get(m.keyword.toLowerCase());
        if (!dfs) return m;
        return {
          ...m,
          source: "dataforseo",
          volume: dfs.volume,
          competition: dfs.competition,
          metric: "search_volume",
          value: dfs.volume,
        };
      });
    }
  } else if (input.enabled.dataforseo && !isDataForSeoConfigured()) {
    dataNotice =
      "Volume Google tidak tersedia (DataForSEO belum dikonfigurasi). Ranking berdasarkan sumber marketplace/Trends.";
  }

  const needTrend = merged
    .filter((m) => !m.trend)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 15);

  if (input.enabled.googleTrends) {
    for (const m of needTrend) {
      m.trend = await fetchInterestTrend(m.keyword);
    }
  }

  return {
    signals: merged,
    dataNotice,
  };
}

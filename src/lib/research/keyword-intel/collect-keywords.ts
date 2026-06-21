import "server-only";

import { ResearchMarketplace } from "@prisma/client";
import { fetchMarketplaceAutocomplete } from "@/lib/research/keyword-intel/marketplace-autocomplete";
import {
  fetchInterestTrendsForKeywords,
  fetchRelatedKeywords,
} from "@/lib/research/keyword-intel/google-trends-keywords";
import { mergeKeywordTrend, inferTrendFromAutocompleteMeta } from "@/lib/research/keyword-intel/keyword-trend";
import {
  getGoogleTrendsUnavailableNotice,
  isGoogleTrendsCircuitOpen,
} from "@/lib/research/google-trends-client";
import {
  enrichKeywordVolumeMetrics,
  countProxyVolumeKeywords,
} from "@/lib/research/keyword-intel/keyword-volume-proxy";
import {
  fetchKeywordVolumesFromDataForSeo,
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
    existing.trend = mergeKeywordTrend(existing.trend, s.trend) ?? undefined;
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
        value: hit.rank != null ? Math.max(1, 21 - hit.rank) : 1,
        meta:
          hit.rank != null || hit.suggestionType
            ? {
                ...(hit.rank != null ? { rank: hit.rank } : {}),
                ...(hit.suggestionType
                  ? { suggestion_type: hit.suggestionType }
                  : {}),
              }
            : undefined,
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
    const forVolume = merged.map((m) => m.keyword);
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
          trend: mergeKeywordTrend(m.trend, dfs.trend) ?? dfs.trend ?? undefined,
        };
      });
    }
  } else if (input.enabled.dataforseo && !isDataForSeoConfigured()) {
    dataNotice =
      "Volume Google tidak tersedia (DataForSEO belum dikonfigurasi). Ranking berdasarkan sumber marketplace/Trends.";
  }

  if (input.enabled.googleTrends) {
    const needTrend = merged
      .filter((m) => !m.trend)
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .map((m) => m.keyword);
    const trendMap = await fetchInterestTrendsForKeywords(needTrend);
    for (const m of merged) {
      const fetched = trendMap.get(m.keyword.toLowerCase());
      if (fetched) {
        m.trend = mergeKeywordTrend(m.trend, fetched) ?? undefined;
      }
    }

    if (isGoogleTrendsCircuitOpen()) {
      for (const m of merged) {
        if (m.trend) continue;
        const fallback = inferTrendFromAutocompleteMeta(m.meta);
        if (fallback) {
          m.trend = mergeKeywordTrend(m.trend, fallback) ?? undefined;
        }
      }
      const notice = getGoogleTrendsUnavailableNotice();
      dataNotice = dataNotice ? `${dataNotice} ${notice}` : notice;
    }
  }

  merged = enrichKeywordVolumeMetrics(merged);

  const proxyCount = countProxyVolumeKeywords(merged);
  if (proxyCount > 0) {
    const proxyNotice = `${proxyCount} keyword memakai estimasi volume/kompetisi dari Shopee autocomplete (tanpa volume Google).`;
    dataNotice = dataNotice ? `${dataNotice} ${proxyNotice}` : proxyNotice;
  }

  return {
    signals: merged,
    dataNotice,
  };
}

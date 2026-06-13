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
import { generateDemoKeywordSignals } from "@/lib/research/keyword-intel/demo-keywords";

export type RawKeywordSignal = {
  keyword: string;
  sources: string[];
  volume?: number;
  competition?: number;
  trend?: "up" | "down" | "stable";
};

export type KeywordVolumeSource = "dataforseo" | "unavailable" | "demo";

export type CollectKeywordResult = {
  signals: RawKeywordSignal[];
  isDemo: boolean;
  volumeSource: KeywordVolumeSource;
  /** Pesan singkat untuk UI (saldo habis, demo, dll.). */
  dataNotice: string | null;
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
}): Promise<CollectKeywordResult> {
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

  let volumeSource: KeywordVolumeSource = "unavailable";
  let dataNotice: string | null = null;

  if (isDataForSeoConfigured() && merged.length > 0) {
    const forVolume = merged.slice(0, getDataForSeoMaxKeywords()).map((m) => m.keyword);
    const dfsResult = await fetchKeywordVolumesFromDataForSeo(forVolume);

    if (dfsResult.balanceExhausted) {
      dataNotice =
        "Saldo DataForSEO habis — volume Google tidak diisi. Top-up saldo di app.dataforseo.com.";
    } else if (dfsResult.errorMessage && dfsResult.data.length === 0) {
      dataNotice = `DataForSEO: ${dfsResult.errorMessage}`;
    } else if (dfsResult.data.length > 0) {
      volumeSource = "dataforseo";
      const volMap = new Map(
        dfsResult.data.map((v) => [v.keyword.toLowerCase(), v]),
      );
      merged = merged.map((m) => {
        const dfs = volMap.get(m.keyword.toLowerCase());
        if (!dfs) return m;
        return {
          ...m,
          volume: dfs.volume,
          competition: dfs.competition,
          sources: [...m.sources, "dataforseo"],
        };
      });
    }
  }

  const needTrend = merged
    .filter((m) => !m.trend)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 15);
  for (const m of needTrend) {
    m.trend = await fetchInterestTrend(m.keyword);
  }

  if (merged.length === 0) {
    return {
      signals: generateDemoKeywordSignals(input.category),
      isDemo: true,
      volumeSource: "demo",
      dataNotice:
        "Data demo — Shopee autocomplete (Apify) dan Google Trends tidak mengembalikan keyword untuk seed ini.",
    };
  }

  if (volumeSource === "unavailable" && !dataNotice) {
    dataNotice =
      "Volume Google tidak tersedia (DataForSEO belum dikonfigurasi). Ranking berdasarkan sumber Shopee/Trends.";
  }

  return {
    signals: merged.slice(0, 80),
    isDemo: false,
    volumeSource,
    dataNotice,
  };
}

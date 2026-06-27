import "server-only";

import { SeoKeywordIntent } from "@prisma/client";
import {
  dataForSeoLive,
  getDataForSeoLanguageCode,
  getDataForSeoLocationCode,
  normalizeCompetition,
} from "@/lib/seo/dataforseo/client";
import { withDataForSeoCache } from "@/lib/seo/dataforseo/cache";

/** Satu keyword hasil riset (sudah dinormalisasi dari DataForSEO Labs). */
export type SeoKeywordIdea = {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  /** 0–1. */
  competition: number | null;
  /** 0–100. */
  difficulty: number | null;
  intent: SeoKeywordIntent;
  monthlyTrend: KeywordMonthlyTrend | null;
  source: string;
};

export type KeywordMonthlyTrend = {
  direction: "up" | "down" | "flat";
  points: { year: number; month: number; volume: number }[];
};

export type KeywordResearchOptions = {
  locationCode?: number;
  languageCode?: number | string;
  /** Maksimum keyword yang dikembalikan (default 100, cap 1000). */
  limit?: number;
};

type DfsMonthly = { year?: number; month?: number; search_volume?: number | null };

type DfsKeywordInfo = {
  search_volume?: number | null;
  cpc?: number | null;
  competition?: number | null;
  competition_level?: string | null;
  monthly_searches?: DfsMonthly[] | null;
};

type DfsSuggestionItem = {
  keyword?: string;
  keyword_info?: DfsKeywordInfo | null;
  keyword_properties?: { keyword_difficulty?: number | null } | null;
  search_intent_info?: { main_intent?: string | null } | null;
};

type DfsSuggestionsResult = {
  items?: DfsSuggestionItem[] | null;
};

type DfsDifficultyItem = {
  keyword?: string;
  keyword_difficulty?: number | null;
};

type DfsDifficultyResult = {
  items?: DfsDifficultyItem[] | null;
};

function mapIntent(raw: string | null | undefined): SeoKeywordIntent {
  switch ((raw ?? "").toLowerCase()) {
    case "informational":
      return SeoKeywordIntent.INFORMATIONAL;
    case "commercial":
      return SeoKeywordIntent.COMMERCIAL;
    case "transactional":
      return SeoKeywordIntent.TRANSACTIONAL;
    case "navigational":
      return SeoKeywordIntent.NAVIGATIONAL;
    default:
      return SeoKeywordIntent.UNKNOWN;
  }
}

function parseMonthlyTrend(
  monthly: DfsMonthly[] | null | undefined,
): KeywordMonthlyTrend | null {
  if (!monthly?.length) return null;
  const points = monthly
    .filter((m) => m.search_volume != null && Number.isFinite(m.search_volume))
    .map((m) => ({
      year: m.year ?? 0,
      month: m.month ?? 0,
      volume: Math.max(0, m.search_volume ?? 0),
    }))
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));

  if (points.length < 4) return points.length ? { direction: "flat", points } : null;

  const recent = points.slice(-3).reduce((s, p) => s + p.volume, 0) / 3;
  const prior = points.slice(-6, -3);
  const priorAvg = prior.length
    ? prior.reduce((s, p) => s + p.volume, 0) / prior.length
    : recent;
  const ratio = priorAvg > 0 ? recent / priorAvg : 1;
  const direction = ratio >= 1.15 ? "up" : ratio <= 0.85 ? "down" : "flat";
  return { direction, points };
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || (limit ?? 0) <= 0) return 100;
  return Math.min(1000, Math.floor(limit!));
}

/**
 * Ambil keyword suggestions (long-tail yang mengandung seed) beserta volume,
 * CPC, competition, intent, dan tren bulanan. Endpoint:
 * `dataforseo_labs/google/keyword_suggestions/live`.
 */
export async function fetchKeywordSuggestions(
  seed: string,
  opts: KeywordResearchOptions = {},
): Promise<SeoKeywordIdea[]> {
  const keyword = seed.trim();
  if (!keyword) return [];

  const locationCode = opts.locationCode ?? getDataForSeoLocationCode();
  const languageCode = String(opts.languageCode ?? getDataForSeoLanguageCode());
  const limit = clampLimit(opts.limit);
  const endpoint = "dataforseo_labs/google/keyword_suggestions/live";
  const payload = {
    keyword,
    location_code: locationCode,
    language_code: languageCode,
    include_serp_info: false,
    limit,
  };

  const items = await withDataForSeoCache(endpoint, payload, async () => {
    const result = await dataForSeoLive<DfsSuggestionsResult>(endpoint, payload);
    return result[0]?.items ?? [];
  });

  return items
    .map((item): SeoKeywordIdea | null => {
      const kw = item.keyword?.trim();
      if (!kw) return null;
      const info = item.keyword_info ?? {};
      return {
        keyword: kw,
        searchVolume:
          info.search_volume != null && Number.isFinite(info.search_volume)
            ? Math.max(0, info.search_volume)
            : null,
        cpc: info.cpc != null && Number.isFinite(info.cpc) ? info.cpc : null,
        competition: normalizeCompetition(item.keyword_info?.competition),
        difficulty:
          item.keyword_properties?.keyword_difficulty != null
            ? Math.round(item.keyword_properties.keyword_difficulty)
            : null,
        intent: mapIntent(item.search_intent_info?.main_intent),
        monthlyTrend: parseMonthlyTrend(info.monthly_searches),
        source: "dataforseo_labs",
      };
    })
    .filter((k): k is SeoKeywordIdea => k != null);
}

/**
 * Lengkapi keyword difficulty (0–100) dalam satu panggilan untuk hingga 1000
 * keyword. Endpoint: `dataforseo_labs/google/bulk_keyword_difficulty/live`.
 * Mengembalikan map keyword → difficulty.
 */
export async function fetchBulkKeywordDifficulty(
  keywords: string[],
  opts: KeywordResearchOptions = {},
): Promise<Map<string, number>> {
  const unique = [...new Set(keywords.map((k) => k.trim()).filter(Boolean))].slice(0, 1000);
  const out = new Map<string, number>();
  if (unique.length === 0) return out;

  const locationCode = opts.locationCode ?? getDataForSeoLocationCode();
  const languageCode = String(opts.languageCode ?? getDataForSeoLanguageCode());
  const endpoint = "dataforseo_labs/google/bulk_keyword_difficulty/live";
  const payload = {
    keywords: unique,
    location_code: locationCode,
    language_code: languageCode,
  };

  const items = await withDataForSeoCache(endpoint, payload, async () => {
    const result = await dataForSeoLive<DfsDifficultyResult>(endpoint, payload);
    return result[0]?.items ?? [];
  });

  for (const item of items) {
    const kw = item.keyword?.trim();
    if (kw && item.keyword_difficulty != null && Number.isFinite(item.keyword_difficulty)) {
      out.set(kw, Math.round(item.keyword_difficulty));
    }
  }
  return out;
}

/**
 * Pipeline ringkas: ambil suggestions lalu lengkapi difficulty yang kosong via
 * satu panggilan bulk. Seed selalu disertakan di hasil (volume diisi bila ada).
 */
export async function collectKeywordIdeas(
  seed: string,
  opts: KeywordResearchOptions = {},
): Promise<SeoKeywordIdea[]> {
  const suggestions = await fetchKeywordSuggestions(seed, opts);

  // Pastikan seed ada di daftar (kadang tidak muncul di suggestions-nya sendiri).
  const seedKw = seed.trim().toLowerCase();
  const hasSeed = suggestions.some((s) => s.keyword.toLowerCase() === seedKw);
  const ideas = hasSeed
    ? suggestions
    : [
        {
          keyword: seed.trim(),
          searchVolume: null,
          cpc: null,
          competition: null,
          difficulty: null,
          intent: SeoKeywordIntent.UNKNOWN,
          monthlyTrend: null,
          source: "seed",
        } as SeoKeywordIdea,
        ...suggestions,
      ];

  // Lengkapi difficulty yang masih kosong dalam satu panggilan bulk.
  const missing = ideas.filter((k) => k.difficulty == null).map((k) => k.keyword);
  if (missing.length > 0) {
    try {
      const diffMap = await fetchBulkKeywordDifficulty(missing, opts);
      for (const idea of ideas) {
        if (idea.difficulty == null) {
          const d = diffMap.get(idea.keyword);
          if (d != null) idea.difficulty = d;
        }
      }
    } catch (err) {
      console.warn("[seo/keywords] bulk difficulty gagal (diabaikan)", err);
    }
  }

  return ideas;
}

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

/* ------------------------------ helper murni ------------------------------ */

export function mapIntent(raw: string | null | undefined): SeoKeywordIntent {
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

export function parseMonthlyTrend(
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

export function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || (limit ?? 0) <= 0) return 100;
  return Math.min(1000, Math.floor(limit!));
}

/** Porsi slot yang dicadangkan untuk related_keywords (sisanya suggestions). */
export const RELATED_KEYWORDS_SHARE = 0.3;

/** Urutkan volume menurun; volume null selalu di belakang. */
export function sortIdeasByVolume<T extends { searchVolume: number | null }>(
  ideas: T[],
): T[] {
  return [...ideas].sort((a, b) => {
    const av = a.searchVolume;
    const bv = b.searchVolume;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av;
  });
}

/**
 * Gabungkan dua kolam ide dengan cadangan slot untuk kolam sekunder
 * (related). Dedupe case-insensitive — kolam primer menang karena datanya
 * lebih lengkap. Bila salah satu kolam kurang, kolam lain mengisi sisanya.
 * Hasil terurut volume menurun (null di belakang), panjang ≤ `limit`.
 */
export function mergeIdeaPools(
  primary: SeoKeywordIdea[],
  secondary: SeoKeywordIdea[],
  limit: number,
  secondaryShare: number = RELATED_KEYWORDS_SHARE,
): SeoKeywordIdea[] {
  const cap = Math.max(0, Math.floor(limit));
  if (cap === 0) return [];

  const seen = new Set<string>();
  const primaryUnique = primary.filter((idea) => {
    const key = idea.keyword.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const secondaryUnique = secondary.filter((idea) => {
    const key = idea.keyword.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const primarySorted = sortIdeasByVolume(primaryUnique);
  const secondarySorted = sortIdeasByVolume(secondaryUnique);

  const share = Math.min(1, Math.max(0, secondaryShare));
  let secondaryTake = Math.min(secondarySorted.length, Math.ceil(cap * share));
  let primaryTake = Math.min(primarySorted.length, cap - secondaryTake);
  // Isi sisa slot dari kolam yang masih punya kandidat.
  const remaining = cap - primaryTake - secondaryTake;
  if (remaining > 0) {
    secondaryTake = Math.min(secondarySorted.length, secondaryTake + remaining);
    primaryTake = Math.min(primarySorted.length, cap - secondaryTake);
  }

  return sortIdeasByVolume([
    ...primarySorted.slice(0, primaryTake),
    ...secondarySorted.slice(0, secondaryTake),
  ]);
}

export function buildSeedIdea(seed: string): SeoKeywordIdea {
  return {
    keyword: seed.trim(),
    searchVolume: null,
    cpc: null,
    competition: null,
    difficulty: null,
    intent: SeoKeywordIntent.UNKNOWN,
    monthlyTrend: null,
    source: "seed",
  };
}

/**
 * Pastikan seed berada di urutan pertama (dipindahkan bila sudah ada, dibuat
 * stub bila belum), lalu potong ke `limit` sehingga totalnya tepat ≤ limit
 * termasuk seed. Mengembalikan flag apakah seed berupa stub (perlu enrichment).
 */
export function finalizeIdeasWithSeed(
  seed: string,
  ideas: SeoKeywordIdea[],
  limit: number,
): { ideas: SeoKeywordIdea[]; seedInserted: boolean } {
  const cap = Math.max(1, Math.floor(limit));
  const seedKey = seed.trim().toLowerCase();
  const existingIndex = ideas.findIndex(
    (idea) => idea.keyword.trim().toLowerCase() === seedKey,
  );
  if (existingIndex >= 0) {
    const seedIdea = ideas[existingIndex]!;
    const rest = ideas.filter((_, i) => i !== existingIndex);
    return { ideas: [seedIdea, ...rest].slice(0, cap), seedInserted: false };
  }
  return {
    ideas: [buildSeedIdea(seed), ...ideas].slice(0, cap),
    seedInserted: true,
  };
}

/* ------------------------------ suggestions ------------------------------ */

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

/* ------------------------------ bulk difficulty ------------------------------ */

/**
 * Lengkapi keyword difficulty (0–100) dalam satu panggilan untuk hingga 1000
 * keyword. Endpoint: `dataforseo_labs/google/bulk_keyword_difficulty/live`.
 * Mengembalikan map keyword (lower-case) → difficulty.
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
    const kw = item.keyword?.trim().toLowerCase();
    if (kw && item.keyword_difficulty != null && Number.isFinite(item.keyword_difficulty)) {
      out.set(kw, Math.round(item.keyword_difficulty));
    }
  }
  return out;
}

/* ------------------------------ bulk volume ------------------------------ */

type DfsSearchVolumeEntry = {
  keyword?: string | null;
  search_volume?: number | null;
  cpc?: number | null;
  competition?: number | string | null;
  competition_index?: number | null;
  monthly_searches?: DfsMonthly[] | null;
};

export type KeywordVolumeMetrics = {
  searchVolume: number | null;
  cpc: number | null;
  /** 0–1. */
  competition: number | null;
  monthlyTrend: KeywordMonthlyTrend | null;
};

/**
 * Volume, CPC, competition, dan tren bulanan untuk hingga 1000 keyword dalam
 * satu panggilan. Endpoint: `keywords_data/google_ads/search_volume/live`.
 * Map keyword (lower-case) → metrik.
 */
export async function fetchBulkKeywordMetrics(
  keywords: string[],
  opts: KeywordResearchOptions = {},
): Promise<Map<string, KeywordVolumeMetrics>> {
  const unique = [...new Set(keywords.map((k) => k.trim()).filter(Boolean))].slice(0, 1000);
  const out = new Map<string, KeywordVolumeMetrics>();
  if (unique.length === 0) return out;

  const locationCode = opts.locationCode ?? getDataForSeoLocationCode();
  const languageCode = String(opts.languageCode ?? getDataForSeoLanguageCode());
  const endpoint = "keywords_data/google_ads/search_volume/live";
  const payload = {
    keywords: unique,
    location_code: locationCode,
    language_code: languageCode,
  };

  // Catatan: untuk keywords_data, `result` adalah array entri keyword langsung.
  const items = await withDataForSeoCache(endpoint, payload, async () => {
    return await dataForSeoLive<DfsSearchVolumeEntry>(endpoint, payload);
  });

  for (const item of items ?? []) {
    const kw = item.keyword?.trim().toLowerCase();
    if (!kw) continue;
    // Keywords Data: `competition` berupa label (LOW/MEDIUM/HIGH) dan
    // `competition_index` berskala 0–100 — pakai index, fallback angka mentah.
    const competitionRaw: number | null =
      item.competition_index != null && Number.isFinite(item.competition_index)
        ? item.competition_index / 100
        : typeof item.competition === "number"
          ? item.competition
          : null;
    out.set(kw, {
      searchVolume:
        item.search_volume != null && Number.isFinite(item.search_volume)
          ? Math.max(0, item.search_volume)
          : null,
      cpc: item.cpc != null && Number.isFinite(item.cpc) ? item.cpc : null,
      competition: normalizeCompetition(competitionRaw),
      monthlyTrend: parseMonthlyTrend(item.monthly_searches),
    });
  }
  return out;
}

/**
 * Volume pencarian bulanan untuk hingga 1000 keyword dalam satu panggilan.
 * Map keyword (lower-case) → volume. Pembungkus kompatibel di atas
 * `fetchBulkKeywordMetrics` (dipakai rank tracker).
 */
export async function fetchBulkSearchVolume(
  keywords: string[],
  opts: KeywordResearchOptions = {},
): Promise<Map<string, number>> {
  const metrics = await fetchBulkKeywordMetrics(keywords, opts);
  const out = new Map<string, number>();
  for (const [kw, m] of metrics) {
    if (m.searchVolume != null) out.set(kw, m.searchVolume);
  }
  return out;
}

/* ------------------------------ bulk intent ------------------------------ */

type DfsSearchIntentItem = {
  keyword?: string | null;
  keyword_intent?: { label?: string | null; probability?: number | null } | null;
};

/**
 * Intent pencarian untuk hingga 1000 keyword dalam satu panggilan. Endpoint:
 * `dataforseo_labs/google/search_intent/live`. Map keyword (lower-case) →
 * intent (hanya keyword yang punya label).
 */
export async function fetchBulkSearchIntent(
  keywords: string[],
  opts: KeywordResearchOptions = {},
): Promise<Map<string, SeoKeywordIntent>> {
  const unique = [...new Set(keywords.map((k) => k.trim()).filter(Boolean))].slice(0, 1000);
  const out = new Map<string, SeoKeywordIntent>();
  if (unique.length === 0) return out;

  const languageCode = String(opts.languageCode ?? getDataForSeoLanguageCode());
  const endpoint = "dataforseo_labs/google/search_intent/live";
  const payload = { keywords: unique, language_code: languageCode };

  const items = await withDataForSeoCache(endpoint, payload, async () => {
    const result = await dataForSeoLive<{ items?: DfsSearchIntentItem[] | null }>(
      endpoint,
      payload,
    );
    return result[0]?.items ?? [];
  });

  for (const item of items ?? []) {
    const kw = item.keyword?.trim().toLowerCase();
    if (!kw) continue;
    const intent = mapIntent(item.keyword_intent?.label);
    if (intent !== SeoKeywordIntent.UNKNOWN) out.set(kw, intent);
  }
  return out;
}

/* ------------------------------ related keywords ------------------------------ */

type DfsRelatedItem = {
  keyword_data?: {
    keyword?: string | null;
    keyword_info?: {
      search_volume?: number | null;
      cpc?: number | null;
      competition?: number | null;
      monthly_searches?: { year?: number; month?: number; search_volume?: number }[] | null;
    } | null;
    keyword_properties?: { keyword_difficulty?: number | null } | null;
    search_intent_info?: { main_intent?: string | null } | null;
  } | null;
};

/**
 * Keyword terkait secara semantik (tidak harus mengandung seed) —
 * `dataforseo_labs/google/related_keywords/live` (graf "searches related to").
 * Melengkapi `keyword_suggestions` yang hanya long-tail berisi seed.
 */
export async function fetchRelatedKeywords(
  seed: string,
  opts: KeywordResearchOptions = {},
): Promise<SeoKeywordIdea[]> {
  const keyword = seed.trim();
  if (!keyword) return [];

  const locationCode = opts.locationCode ?? getDataForSeoLocationCode();
  const languageCode = String(opts.languageCode ?? getDataForSeoLanguageCode());
  const endpoint = "dataforseo_labs/google/related_keywords/live";
  const payload = {
    keyword,
    location_code: locationCode,
    language_code: languageCode,
    depth: 2,
    limit: Math.min(200, clampLimit(opts.limit)),
  };

  const items = await withDataForSeoCache(endpoint, payload, async () => {
    const result = await dataForSeoLive<{ items?: DfsRelatedItem[] | null }>(
      endpoint,
      payload,
    );
    return result[0]?.items ?? [];
  });

  return (items ?? [])
    .map((item): SeoKeywordIdea | null => {
      const kw = item.keyword_data?.keyword?.trim();
      if (!kw) return null;
      const info = item.keyword_data?.keyword_info ?? {};
      return {
        keyword: kw,
        searchVolume:
          info.search_volume != null && Number.isFinite(info.search_volume)
            ? Math.max(0, info.search_volume)
            : null,
        cpc: info.cpc != null && Number.isFinite(info.cpc) ? info.cpc : null,
        competition: normalizeCompetition(info.competition),
        difficulty:
          item.keyword_data?.keyword_properties?.keyword_difficulty != null
            ? Math.round(item.keyword_data.keyword_properties.keyword_difficulty)
            : null,
        intent: mapIntent(item.keyword_data?.search_intent_info?.main_intent),
        monthlyTrend: parseMonthlyTrend(info.monthly_searches),
        source: "dataforseo_labs_related",
      };
    })
    .filter((k): k is SeoKeywordIdea => k != null);
}

/* ------------------------------ enrichment ------------------------------ */

/**
 * Lengkapi field yang masih kosong (volume/CPC/competition/tren, difficulty,
 * intent) via endpoint bulk. Mutasi in-place; tiap endpoint best-effort —
 * kegagalan satu endpoint tidak membatalkan yang lain.
 */
export async function enrichKeywordIdeas(
  ideas: SeoKeywordIdea[],
  opts: KeywordResearchOptions = {},
): Promise<SeoKeywordIdea[]> {
  const needsMetrics = ideas.filter(
    (k) => k.searchVolume == null || k.cpc == null || k.competition == null,
  );
  if (needsMetrics.length > 0) {
    try {
      const metrics = await fetchBulkKeywordMetrics(
        needsMetrics.map((k) => k.keyword),
        opts,
      );
      for (const idea of needsMetrics) {
        const m = metrics.get(idea.keyword.trim().toLowerCase());
        if (!m) continue;
        if (idea.searchVolume == null) idea.searchVolume = m.searchVolume;
        if (idea.cpc == null) idea.cpc = m.cpc;
        if (idea.competition == null) idea.competition = m.competition;
        if (idea.monthlyTrend == null) idea.monthlyTrend = m.monthlyTrend;
      }
    } catch (err) {
      console.warn("[seo/keywords] bulk search volume gagal (diabaikan)", err);
    }
  }

  const needsDifficulty = ideas.filter((k) => k.difficulty == null);
  if (needsDifficulty.length > 0) {
    try {
      const diffMap = await fetchBulkKeywordDifficulty(
        needsDifficulty.map((k) => k.keyword),
        opts,
      );
      for (const idea of needsDifficulty) {
        const d = diffMap.get(idea.keyword.trim().toLowerCase());
        if (d != null) idea.difficulty = d;
      }
    } catch (err) {
      console.warn("[seo/keywords] bulk difficulty gagal (diabaikan)", err);
    }
  }

  const needsIntent = ideas.filter((k) => k.intent === SeoKeywordIntent.UNKNOWN);
  if (needsIntent.length > 0) {
    try {
      const intentMap = await fetchBulkSearchIntent(
        needsIntent.map((k) => k.keyword),
        opts,
      );
      for (const idea of needsIntent) {
        const intent = intentMap.get(idea.keyword.trim().toLowerCase());
        if (intent) idea.intent = intent;
      }
    } catch (err) {
      console.warn("[seo/keywords] bulk search intent gagal (diabaikan)", err);
    }
  }

  return ideas;
}

/* ------------------------------ pipeline ------------------------------ */

/**
 * Pipeline ringkas: gabungkan suggestions (long-tail berisi seed) + related
 * keywords (semantik terkait) dengan cadangan slot ~30% untuk related, lalu
 * lengkapi difficulty yang kosong via satu panggilan bulk. Seed selalu di
 * urutan pertama (di-enrich via bulk volume bila tidak muncul di hasil);
 * total hasil ≤ `limit` termasuk seed.
 */
export async function collectKeywordIdeas(
  seed: string,
  opts: KeywordResearchOptions = {},
): Promise<SeoKeywordIdea[]> {
  const limit = clampLimit(opts.limit);
  const relatedLimit = Math.max(10, Math.ceil(limit * RELATED_KEYWORDS_SHARE));

  // Suggestions diminta dengan `limit` penuh agar bila related gagal daftar
  // tetap terisi; porsi related dijamin saat penggabungan (mergeIdeaPools).
  const [suggestionsRaw, relatedRaw] = await Promise.allSettled([
    fetchKeywordSuggestions(seed, { ...opts, limit }),
    fetchRelatedKeywords(seed, { ...opts, limit: relatedLimit }),
  ]);
  if (suggestionsRaw.status === "rejected") throw suggestionsRaw.reason;
  if (relatedRaw.status === "rejected") {
    console.warn(
      "[seo/keywords] related_keywords gagal (lanjut dengan suggestions)",
      relatedRaw.reason,
    );
  }

  const merged = mergeIdeaPools(
    suggestionsRaw.value,
    relatedRaw.status === "fulfilled" ? relatedRaw.value : [],
    limit,
  );
  const { ideas, seedInserted } = finalizeIdeasWithSeed(seed, merged, limit);

  // Seed stub: isi volume/CPC/competition via bulk volume.
  if (seedInserted) {
    const seedIdea = ideas[0];
    if (seedIdea) {
      try {
        const metrics = await fetchBulkKeywordMetrics([seedIdea.keyword], opts);
        const m = metrics.get(seedIdea.keyword.trim().toLowerCase());
        if (m) {
          seedIdea.searchVolume = m.searchVolume;
          seedIdea.cpc = m.cpc;
          seedIdea.competition = m.competition;
          seedIdea.monthlyTrend = m.monthlyTrend;
        }
      } catch (err) {
        console.warn("[seo/keywords] enrichment seed gagal (diabaikan)", err);
      }
    }
  }

  // Lengkapi difficulty yang masih kosong dalam satu panggilan bulk.
  const missing = ideas.filter((k) => k.difficulty == null).map((k) => k.keyword);
  if (missing.length > 0) {
    try {
      const diffMap = await fetchBulkKeywordDifficulty(missing, opts);
      for (const idea of ideas) {
        if (idea.difficulty == null) {
          const d = diffMap.get(idea.keyword.trim().toLowerCase());
          if (d != null) idea.difficulty = d;
        }
      }
    } catch (err) {
      console.warn("[seo/keywords] bulk difficulty gagal (diabaikan)", err);
    }
  }

  return ideas;
}

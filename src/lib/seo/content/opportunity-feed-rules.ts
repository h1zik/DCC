import {
  SeoKeywordIntent,
  SeoOpportunityStage,
  SeoOpportunityType,
} from "@prisma/client";
import {
  scoreKeywordOpportunity,
  type OpportunityInput,
} from "@/lib/seo/content/opportunity";

/**
 * Aturan pure feed Content Opportunities: klasifikasi kandidat dari rank
 * tracker, derivasi stage, dan keputusan merge saat upsert. Dipisah dari
 * engine (opportunity-feed.ts) agar mudah di-test.
 */

/** Posisi 1–4 = sudah menang; tidak perlu artikel baru maupun optimasi. */
export const TOP_RANKING_MAX = 4;
/** Posisi 5–20 = "striking distance" → optimasi konten existing lebih murah. */
export const STRIKING_DISTANCE_MIN = 5;
export const STRIKING_DISTANCE_MAX = 20;
/** Posisi 21–30 = halaman 2–3; optimasi tetap lebih murah dari artikel baru. */
export const NEAR_STRIKING_MIN = 21;
export const NEAR_STRIKING_MAX = 30;
/** Boost skor untuk peluang optimasi (quick win). */
export const STRIKING_DISTANCE_MULTIPLIER = 1.3;
/** Posisi 21–30: tanpa boost (prioritas di bawah striking distance). */
export const NEAR_STRIKING_MULTIPLIER = 1;

/**
 * Sumber baris yang DIBUAT engine refresh. Hanya baris bersumber ini yang
 * boleh dipangkas saat refresh; simpanan manual ("topic_run", "gsc_decay",
 * dsb.) tidak pernah dihapus otomatis.
 */
export const ENGINE_SOURCES = ["keyword_project", "rank_tracker"] as const;

/** Normalisasi keyword untuk semua jalur tulis (kolom unik per keyword). */
export function normalizeOpportunityKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, " ");
}

export type TrackedCandidate = {
  keyword: string;
  lastPosition: number | null;
  lastFoundUrl: string | null;
  /** Apakah keyword ini juga ada di keyword project (punya data volume dsb.). */
  inKeywordProject: boolean;
};

export type OpportunityCandidate = {
  keyword: string;
  type: SeoOpportunityType;
  searchVolume: number | null;
  difficulty: number | null;
  intent: SeoKeywordIntent;
  opportunityScore: number;
  currentPosition: number | null;
  targetUrl: string | null;
  source: string;
  sourceRefId: string | null;
};

/** Klasifikasi kandidat dari tracked keyword rank tracker. */
export function classifyTrackedKeyword(
  cand: TrackedCandidate,
): SeoOpportunityType | null {
  const pos = cand.lastPosition;
  // 5–20 (striking distance) dan 21–30 (near) → optimasi halaman yang ada.
  if (pos != null && pos >= STRIKING_DISTANCE_MIN && pos <= NEAR_STRIKING_MAX) {
    return SeoOpportunityType.OPTIMIZE_EXISTING;
  }
  // Tidak ranking (atau jauh) tapi keyword-nya sudah diriset → artikel baru.
  if ((pos == null || pos > NEAR_STRIKING_MAX) && cand.inKeywordProject) {
    return SeoOpportunityType.NEW_ARTICLE;
  }
  return null;
}

/** Apakah posisi tracked sudah di top 4 (tidak perlu masuk feed). */
export function isTopRanking(position: number | null | undefined): boolean {
  return position != null && position >= 1 && position <= TOP_RANKING_MAX;
}

/**
 * Skor peluang dengan boost striking distance untuk OPTIMIZE_EXISTING.
 * Posisi 21–30 memakai multiplier lebih rendah (prioritas di bawah 5–20).
 */
export function scoreCandidate(
  input: OpportunityInput,
  type: SeoOpportunityType,
  position: number | null = null,
): number {
  const base = scoreKeywordOpportunity(input).score;
  if (type !== SeoOpportunityType.OPTIMIZE_EXISTING) return base;
  const multiplier =
    position != null && position >= NEAR_STRIKING_MIN
      ? NEAR_STRIKING_MULTIPLIER
      : STRIKING_DISTANCE_MULTIPLIER;
  return Math.min(100, Math.round(base * multiplier));
}

/**
 * Buang kandidat yang keyword-nya sudah ranking top 4 di rank tracker
 * (artikel baru untuk keyword yang sudah menang = kanibalisasi).
 */
export function excludeTopRanking(
  candidates: OpportunityCandidate[],
  topRankingKeywords: Set<string>,
): OpportunityCandidate[] {
  return candidates.filter(
    (c) => !topRankingKeywords.has(normalizeOpportunityKeyword(c.keyword)),
  );
}

/**
 * Pilih id baris IDEA tanpa brief yang boleh dipangkas: hanya baris bersumber
 * engine (`engineSources`) yang keyword-nya tidak lagi ada di hasil refresh.
 */
export function selectPruneIds(
  rows: { id: string; keyword: string; source: string }[],
  keepKeywords: Set<string>,
  engineSources: readonly string[] = ENGINE_SOURCES,
): string[] {
  const engine = new Set(engineSources);
  return rows
    .filter(
      (r) =>
        engine.has(r.source) &&
        !keepKeywords.has(normalizeOpportunityKeyword(r.keyword)),
    )
    .map((r) => r.id);
}

/** Derivasi stage dari relasi aktual (stage tidak pernah turun otomatis). */
export function deriveStage(state: {
  current: SeoOpportunityStage;
  hasBrief: boolean;
  hasDraft: boolean;
  publishedUrl: string | null;
}): SeoOpportunityStage {
  if (state.current === SeoOpportunityStage.DISMISSED) {
    return SeoOpportunityStage.DISMISSED;
  }
  const derived = state.publishedUrl
    ? SeoOpportunityStage.PUBLISHED
    : state.hasDraft
      ? SeoOpportunityStage.DRAFTED
      : state.hasBrief
        ? SeoOpportunityStage.BRIEFED
        : SeoOpportunityStage.IDEA;

  return stageRank(derived) >= stageRank(state.current)
    ? derived
    : state.current;
}

function stageRank(stage: SeoOpportunityStage): number {
  switch (stage) {
    case SeoOpportunityStage.IDEA:
      return 0;
    case SeoOpportunityStage.BRIEFED:
      return 1;
    case SeoOpportunityStage.DRAFTED:
      return 2;
    case SeoOpportunityStage.PUBLISHED:
      return 3;
    case SeoOpportunityStage.DISMISSED:
      return 4;
  }
}

/**
 * Gabungkan kandidat duplikat (satu keyword bisa muncul dari beberapa sumber):
 * OPTIMIZE_EXISTING menang (lebih actionable), lalu skor tertinggi.
 */
export function mergeCandidates(
  candidates: OpportunityCandidate[],
): OpportunityCandidate[] {
  const byKeyword = new Map<string, OpportunityCandidate>();
  for (const cand of candidates) {
    const key = cand.keyword.trim().toLowerCase();
    if (!key) continue;
    const existing = byKeyword.get(key);
    if (!existing) {
      byKeyword.set(key, cand);
      continue;
    }
    const candWins =
      (cand.type === SeoOpportunityType.OPTIMIZE_EXISTING) !==
      (existing.type === SeoOpportunityType.OPTIMIZE_EXISTING)
        ? cand.type === SeoOpportunityType.OPTIMIZE_EXISTING
        : cand.opportunityScore > existing.opportunityScore;
    if (candWins) {
      // Pertahankan data volume/difficulty terbaik dari keduanya.
      byKeyword.set(key, {
        ...cand,
        searchVolume: cand.searchVolume ?? existing.searchVolume,
        difficulty: cand.difficulty ?? existing.difficulty,
        intent:
          cand.intent !== SeoKeywordIntent.UNKNOWN ? cand.intent : existing.intent,
      });
    } else {
      byKeyword.set(key, {
        ...existing,
        searchVolume: existing.searchVolume ?? cand.searchVolume,
        difficulty: existing.difficulty ?? cand.difficulty,
        intent:
          existing.intent !== SeoKeywordIntent.UNKNOWN
            ? existing.intent
            : cand.intent,
      });
    }
  }
  return [...byKeyword.values()].sort(
    (a, b) => b.opportunityScore - a.opportunityScore,
  );
}

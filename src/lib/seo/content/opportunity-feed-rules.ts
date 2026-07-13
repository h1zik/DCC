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

/** Posisi 5–20 = "striking distance" → optimasi konten existing lebih murah. */
export const STRIKING_DISTANCE_MIN = 5;
export const STRIKING_DISTANCE_MAX = 20;
/** Boost skor untuk peluang optimasi (quick win). */
export const STRIKING_DISTANCE_MULTIPLIER = 1.3;

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
  if (
    pos != null &&
    pos >= STRIKING_DISTANCE_MIN &&
    pos <= STRIKING_DISTANCE_MAX
  ) {
    return SeoOpportunityType.OPTIMIZE_EXISTING;
  }
  // Tidak ranking (atau jauh) tapi keyword-nya sudah diriset → artikel baru.
  if ((pos == null || pos > 30) && cand.inKeywordProject) {
    return SeoOpportunityType.NEW_ARTICLE;
  }
  return null;
}

/** Skor peluang dengan boost striking distance untuk OPTIMIZE_EXISTING. */
export function scoreCandidate(
  input: OpportunityInput,
  type: SeoOpportunityType,
): number {
  const base = scoreKeywordOpportunity(input).score;
  return type === SeoOpportunityType.OPTIMIZE_EXISTING
    ? Math.min(100, Math.round(base * STRIKING_DISTANCE_MULTIPLIER))
    : base;
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

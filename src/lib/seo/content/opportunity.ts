import { SeoKeywordIntent } from "@prisma/client";

/**
 * Opportunity scoring untuk Topic Discovery. Tujuan: menemukan keyword yang
 * **layak ditulis DAN realistis dimenangkan** — bukan sekadar "populer".
 *
 * Skor = kombinasi volume (log-scaled), kemudahan (kebalikan difficulty),
 * dan kecocokan intent B2C, dikali momentum tren. Pure (tanpa server) agar
 * mudah di-test dan transparan.
 */

export type OpportunityInput = {
  searchVolume: number | null;
  /** 0–100 keyword difficulty. */
  difficulty: number | null;
  intent: SeoKeywordIntent;
  monthlyTrend?: { direction?: "up" | "down" | "flat" } | null;
};

export type OpportunityScore = {
  /** 0–100. Makin tinggi makin layak diprioritaskan. */
  score: number;
  volumeScore: number;
  easeScore: number;
  intentScore: number;
  trendMultiplier: number;
};

/** Bobot intent untuk brand kosmetik B2C (transaksional/komersial diutamakan). */
const INTENT_WEIGHT: Record<SeoKeywordIntent, number> = {
  TRANSACTIONAL: 1,
  COMMERCIAL: 0.9,
  INFORMATIONAL: 0.6,
  NAVIGATIONAL: 0.3,
  UNKNOWN: 0.5,
};

/** Bobot komponen (kemudahan diutamakan agar "winnable" menang dari "populer"). */
const W_VOLUME = 0.4;
const W_EASE = 0.45;
const W_INTENT = 0.15;

/** log10(100000) — volume 100rb dianggap "penuh" untuk normalisasi. */
const VOLUME_LOG_MAX = 5;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

export function scoreKeywordOpportunity(
  input: OpportunityInput,
): OpportunityScore {
  const volumeScore =
    input.searchVolume == null
      ? 0.2
      : clamp01(Math.log10(input.searchVolume + 1) / VOLUME_LOG_MAX);

  const easeScore =
    input.difficulty == null ? 0.5 : clamp01(1 - input.difficulty / 100);

  const intentScore = INTENT_WEIGHT[input.intent] ?? 0.5;

  const dir = input.monthlyTrend?.direction;
  const trendMultiplier = dir === "up" ? 1.1 : dir === "down" ? 0.9 : 1;

  const raw =
    volumeScore * W_VOLUME + easeScore * W_EASE + intentScore * W_INTENT;
  const score = Math.round(clamp01(raw * trendMultiplier) * 100);

  return {
    score,
    volumeScore: round2(volumeScore),
    easeScore: round2(easeScore),
    intentScore: round2(intentScore),
    trendMultiplier,
  };
}

/** Urutkan kandidat dari opportunity tertinggi ke terendah. */
export function rankByOpportunity<T extends OpportunityInput>(
  items: T[],
): (T & { opportunity: OpportunityScore })[] {
  return items
    .map((item) => ({ ...item, opportunity: scoreKeywordOpportunity(item) }))
    .sort((a, b) => b.opportunity.score - a.opportunity.score);
}

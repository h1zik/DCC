/**
 * Skor "winning" untuk iklan Meta Ad Library. Pure (tanpa server) agar mudah
 * di-test.
 *
 * Realita: untuk iklan komersial (skincare/kosmetik), Meta jarang mengekspos
 * reach/impressions/spend (itu umumnya hanya iklan politik/EU). Sinyal "winning"
 * yang andal justru: BERAPA LAMA iklan tayang (brand mematikan iklan rugi dengan
 * cepat & mempertahankan yang menang) + jumlah varian kreatif (scaling) + masih
 * aktif. Reach dipakai sebagai bonus bila tersedia.
 */

export type AdWinningSignals = {
  /** Lama tayang dalam hari (start → stop|sekarang). Null bila tak ada tanggal. */
  daysRunning: number | null;
  isActive: boolean;
  /** Jumlah varian kreatif (collation_count). */
  collationCount: number | null;
  /** Estimasi audiens teratas (estimated_audience_size.upper) — sering null. */
  audienceUpper: number | null;
  /** Jumlah platform (facebook/instagram/…). */
  platformCount: number;
};

export type AdWinningTier = "hot" | "strong" | "testing" | "new";

export type AdWinningResult = {
  score: number; // 0-100
  tier: AdWinningTier;
  reasons: string[];
};

/** Hari proven-winner: iklan yang tayang ~45 hari dianggap matang. */
const LONGEVITY_DAYS_FULL = 45;
/** Varian untuk dianggap sedang di-scale agresif. */
const VARIATIONS_FULL = 10;

const W_LONGEVITY = 0.45;
const W_VARIATIONS = 0.25;
const W_ACTIVE = 0.15;
const W_REACH = 0.15;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Hitung lama tayang (hari). `now` di-pass agar fungsi tetap pure/testable. */
export function computeDaysRunning(
  start: Date | null | undefined,
  stop: Date | null | undefined,
  now: Date,
): number | null {
  if (!start) return null;
  const end = stop ?? now;
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function scoreAdWinning(signals: AdWinningSignals): AdWinningResult {
  const longevity = signals.daysRunning != null
    ? clamp01(signals.daysRunning / LONGEVITY_DAYS_FULL)
    : 0;
  const variations = signals.collationCount != null
    ? clamp01(signals.collationCount / VARIATIONS_FULL)
    : 0;
  const active = signals.isActive ? 1 : 0;
  // Reach jarang tersedia untuk iklan komersial → baseline netral agar tidak
  // menghukum iklan yang reach-nya memang tidak diekspos Meta.
  const reach = signals.audienceUpper != null
    ? clamp01(Math.log10(signals.audienceUpper + 1) / 6)
    : 0.3;

  const raw =
    longevity * W_LONGEVITY +
    variations * W_VARIATIONS +
    active * W_ACTIVE +
    reach * W_REACH;
  const score = Math.round(clamp01(raw) * 100);

  const reasons: string[] = [];
  if (signals.daysRunning != null && signals.daysRunning >= 21) {
    reasons.push(`Tayang ${signals.daysRunning} hari`);
  }
  if (signals.collationCount != null && signals.collationCount >= 3) {
    reasons.push(`${signals.collationCount} varian kreatif`);
  }
  if (signals.isActive) reasons.push("Masih aktif");
  if (signals.audienceUpper != null && signals.audienceUpper >= 100000) {
    reasons.push("Estimasi audiens besar");
  }
  if (signals.platformCount >= 3) reasons.push("Multi-platform");

  return { score, tier: winningTierFromScore(score), reasons };
}

export function winningTierFromScore(score: number): AdWinningTier {
  return score >= 70 ? "hot" : score >= 45 ? "strong" : score >= 20 ? "testing" : "new";
}

export const AD_WINNING_TIER_LABEL: Record<AdWinningTier, string> = {
  hot: "🔥 Winning",
  strong: "Kuat",
  testing: "Testing",
  new: "Baru",
};

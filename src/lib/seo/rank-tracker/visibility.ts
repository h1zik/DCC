/**
 * Visibility score ala Semrush: Σ(CTR(posisi) × volume) / Σ(volume) × 100.
 * Pure agar mudah di-test. Volume null → 1 (degradasi ke bobot posisi murni).
 */

export type VisibilityKeyword = {
  position: number | null;
  searchVolume: number | null;
};

/** Kurva CTR organik standar (posisi 1..20; di luar itu 0). */
const CTR_CURVE: number[] = [
  0.32, 0.155, 0.098, 0.07, 0.052, 0.041, 0.033, 0.027, 0.023, 0.02,
  0.016, 0.014, 0.012, 0.011, 0.01, 0.009, 0.008, 0.007, 0.0065, 0.006,
];

export function ctrForPosition(position: number | null): number {
  if (position == null || position < 1 || position > CTR_CURVE.length) return 0;
  return CTR_CURVE[Math.floor(position) - 1];
}

/** Visibility 0–100 (%) untuk satu set keyword. */
export function visibilityScore(keywords: VisibilityKeyword[]): number {
  if (keywords.length === 0) return 0;
  let earned = 0;
  let possible = 0;
  for (const k of keywords) {
    const volume = k.searchVolume != null && k.searchVolume > 0 ? k.searchVolume : 1;
    earned += ctrForPosition(k.position) * volume;
    possible += CTR_CURVE[0] * volume;
  }
  if (possible === 0) return 0;
  return Math.round((earned / possible) * 1000) / 10;
}

export type ShareOfVoiceEntry = {
  domain: string;
  visibility: number;
};

/**
 * Share of voice antar domain (milik sendiri + kompetitor) dari posisi per
 * keyword: { domain: posisi|null } per keyword + volume.
 */
export function shareOfVoice(
  rows: { volume: number | null; positions: Record<string, number | null> }[],
): ShareOfVoiceEntry[] {
  const domains = new Set<string>();
  for (const row of rows) {
    for (const d of Object.keys(row.positions)) domains.add(d);
  }
  const entries: ShareOfVoiceEntry[] = [];
  for (const domain of domains) {
    entries.push({
      domain,
      visibility: visibilityScore(
        rows.map((r) => ({
          position: r.positions[domain] ?? null,
          searchVolume: r.volume,
        })),
      ),
    });
  }
  return entries.sort((a, b) => b.visibility - a.visibility);
}

/**
 * Visibility score ala Semrush: Σ(CTR(posisi) × volume) / Σ(volume) × 100.
 * Pure agar mudah di-test.
 *
 * Volume null/0 → dibobot MEDIAN volume yang diketahui pada set keyword yang
 * sama (bukan 1), agar keyword tanpa data volume tidak "hilang" dari skor.
 * Bila tidak ada volume yang diketahui sama sekali, semua dibobot 1
 * (tanpa bobot = murni posisi).
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

function knownVolume(k: VisibilityKeyword): number | null {
  return k.searchVolume != null && k.searchVolume > 0 ? k.searchVolume : null;
}

/** Median volume yang diketahui (> 0) dalam set; null bila tidak ada. */
export function medianKnownVolume(keywords: VisibilityKeyword[]): number | null {
  const vols = keywords
    .map(knownVolume)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  if (vols.length === 0) return null;
  const mid = Math.floor(vols.length / 2);
  return vols.length % 2 === 1 ? vols[mid] : (vols[mid - 1] + vols[mid]) / 2;
}

export type VisibilityBreakdown = {
  /** Skor 0–100 (%). */
  score: number;
  /** Jumlah keyword tanpa data volume (dibobot median). */
  unknownVolumeCount: number;
  /** Bobot pengganti yang dipakai untuk keyword tanpa volume (1 = tanpa bobot). */
  fallbackVolume: number;
};

/** Visibility + rincian keyword tanpa volume untuk satu set keyword. */
export function visibilityBreakdown(
  keywords: VisibilityKeyword[],
): VisibilityBreakdown {
  if (keywords.length === 0) {
    return { score: 0, unknownVolumeCount: 0, fallbackVolume: 1 };
  }
  const fallbackVolume = medianKnownVolume(keywords) ?? 1;
  let earned = 0;
  let possible = 0;
  let unknownVolumeCount = 0;
  for (const k of keywords) {
    const known = knownVolume(k);
    if (known == null) unknownVolumeCount += 1;
    const volume = known ?? fallbackVolume;
    earned += ctrForPosition(k.position) * volume;
    possible += CTR_CURVE[0] * volume;
  }
  const score = possible === 0 ? 0 : Math.round((earned / possible) * 1000) / 10;
  return { score, unknownVolumeCount, fallbackVolume };
}

/** Visibility 0–100 (%) untuk satu set keyword. */
export function visibilityScore(keywords: VisibilityKeyword[]): number {
  return visibilityBreakdown(keywords).score;
}

export type ShareOfVoiceEntry = {
  domain: string;
  visibility: number;
};

/**
 * Visibility per domain (milik sendiri + kompetitor) dari posisi per keyword:
 * { domain: posisi|null } per keyword + volume. Nilainya visibility % per
 * domain pada set keyword yang sama — bukan pangsa yang berjumlah 100%.
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

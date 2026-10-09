/**
 * Kalibrasi benchmark ER dari populasi akun yang sudah pernah kita ukur.
 *
 * Benchmark statis per tier hanyalah tebakan awal yang masuk akal. Begitu
 * cukup banyak akun di platform & tier yang sama sudah diaudit, nilai
 * tengah populasi itu jauh lebih jujur sebagai pembanding — itulah pasar yang
 * benar-benar sedang kita pilih.
 *
 * Fungsi di sini murni; pembacaan DB ada di `run-audit.ts`.
 */

/**
 * Bobot prior benchmark statis, dalam satuan "akun". Dengan 30 akun
 * pembanding, benchmark berdiri separuh di statis dan separuh di populasi;
 * dengan 5 akun, populasinya nyaris belum menggeser apa pun.
 */
export const PEER_PRIOR_WEIGHT = 30;

/** Di bawah ini persentil belum layak ditampilkan — terlalu kasar. */
export const PEER_MIN_FOR_PERCENTILE = 15;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Buang nilai yang tidak bisa dipakai membandingkan (nol, negatif, NaN). */
export function cleanPeerRates(rates: number[] | undefined): number[] {
  return (rates ?? []).filter((r) => Number.isFinite(r) && r > 0);
}

/**
 * Persentil `value` di antara `distribution` (0–100), memakai definisi
 * "persen pembanding yang nilainya lebih rendah", dengan nilai seri dihitung
 * separuh. Null bila pembandingnya belum cukup.
 */
export function peerPercentile(
  value: number,
  distribution: number[],
  minCount = PEER_MIN_FOR_PERCENTILE,
): number | null {
  if (distribution.length < minCount || !Number.isFinite(value)) return null;
  let below = 0;
  let equal = 0;
  for (const d of distribution) {
    if (d < value) below += 1;
    else if (d === value) equal += 1;
  }
  return Math.round(((below + equal / 2) / distribution.length) * 100);
}

/**
 * Benchmark campuran: rata-rata geometris berbobot antara benchmark statis
 * dan median populasi. Geometris karena ER tersebar secara log — 2× di atas
 * dan 2× di bawah harus sama jauhnya.
 */
export function blendBenchmark(
  staticBenchmark: number,
  peerMedian: number | null,
  peerCount: number,
): number {
  if (peerMedian === null || peerMedian <= 0 || peerCount <= 0) {
    return staticBenchmark;
  }
  const w = peerCount / (peerCount + PEER_PRIOR_WEIGHT);
  return Math.exp(
    (1 - w) * Math.log(staticBenchmark) + w * Math.log(peerMedian),
  );
}

export function peerMedian(rates: number[]): number | null {
  return median(rates);
}

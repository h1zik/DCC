import { formatRankPosition } from "@/lib/seo/labels";

/**
 * Logika deteksi perubahan ranking SERP. Pure (tanpa dependensi server) agar
 * mudah di-test. Posisi `null` berarti di luar top 100.
 */

export type RankChangeKind = "entered" | "dropped" | "up" | "down" | "same";

/** Ambang pergeseran posisi yang dianggap "signifikan". */
const SIGNIFICANT_DELTA = 3;

export function rankChangeKind(
  prev: number | null,
  next: number | null,
): RankChangeKind {
  if (prev == null && next == null) return "same";
  if (prev == null && next != null) return "entered";
  if (prev != null && next == null) return "dropped";
  // keduanya ada
  if (next! < prev!) return "up"; // posisi mengecil = naik
  if (next! > prev!) return "down";
  return "same";
}

/**
 * Apakah perubahan posisi cukup signifikan untuk memicu notifikasi:
 * - masuk / keluar top 100, atau
 * - melintasi batas top 10 (halaman 1), atau
 * - bergeser >= 3 posisi.
 */
export function isSignificantRankChange(
  prev: number | null,
  next: number | null,
): boolean {
  const kind = rankChangeKind(prev, next);
  if (kind === "same") return false;
  if (kind === "entered" || kind === "dropped") return true;

  const crossedTop10 =
    (prev! > 10 && next! <= 10) || (prev! <= 10 && next! > 10);
  if (crossedTop10) return true;

  return Math.abs(next! - prev!) >= SIGNIFICANT_DELTA;
}

/** Pesan notifikasi Bahasa Indonesia untuk perubahan ranking. */
export function describeRankChange(
  keyword: string,
  prev: number | null,
  next: number | null,
): string {
  const kind = rankChangeKind(prev, next);
  switch (kind) {
    case "entered":
      return `"${keyword}" masuk ke posisi ${formatRankPosition(next)} di Google.`;
    case "dropped":
      return `"${keyword}" keluar dari top 100 (sebelumnya ${formatRankPosition(prev)}).`;
    case "up":
      return `"${keyword}" naik ke posisi ${formatRankPosition(next)} (dari ${formatRankPosition(prev)}).`;
    case "down":
      return `"${keyword}" turun ke posisi ${formatRankPosition(next)} (dari ${formatRankPosition(prev)}).`;
    default:
      return `"${keyword}" tetap di posisi ${formatRankPosition(next)}.`;
  }
}

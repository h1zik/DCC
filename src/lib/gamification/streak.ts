/**
 * Logika streak absensi (murni, di-pin unit test). Streak = jumlah hari kerja
 * beruntun dengan verified check-in. Akhir pekan (Sab/Min) TIDAK memutus streak
 * (mis. check-in Jumat → Senin tetap beruntun); satu hari kerja bolong = reset.
 *
 * Semua tanggal berformat "YYYY-MM-DD" (hari kalender Asia/Jakarta, konsisten
 * dengan Attendance.date & UserProgression.lastCheckinDate).
 */
import { STREAK_MULTIPLIER_CAP, STREAK_MULTIPLIER_TIERS } from "./constants";

const DAY_MS = 86_400_000;

/** Index hari epoch (UTC) dari "YYYY-MM-DD". */
function epochDay(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** Hari dalam minggu (0=Minggu … 6=Sabtu) untuk index hari epoch. */
function dowOfEpochDay(dayIndex: number): number {
  return new Date(dayIndex * DAY_MS).getUTCDay();
}

/**
 * True bila semua hari kalender STRICTLY antara `last` dan `today` adalah akhir
 * pekan (tak ada hari kerja terlewat). Empty gap (hari berurutan) → true.
 */
export function bridgesOnlyWeekend(last: string, today: string): boolean {
  const dl = epochDay(last);
  const dt = epochDay(today);
  if (dt <= dl) return false;
  for (let d = dl + 1; d < dt; d++) {
    const dow = dowOfEpochDay(d);
    if (dow !== 0 && dow !== 6) return false; // hari kerja terlewat
  }
  return true;
}

/**
 * Streak baru setelah verified check-in di `today`, diberi `prevStreak` &
 * `lastCheckinDate` sebelumnya.
 * - lastDate null (pertama kali) → 1
 * - today == lastDate (sudah terhitung hari ini) → prevStreak (tak berubah)
 * - today < lastDate (out-of-order) → prevStreak (abaikan)
 * - today lanjutan hari kerja (hanya akhir pekan yang menjembatani) → prevStreak + 1
 * - selain itu (ada hari kerja bolong) → 1
 */
export function nextStreak(
  prevStreak: number,
  lastDate: string | null,
  today: string,
): number {
  if (!lastDate) return 1;
  const dl = epochDay(lastDate);
  const dt = epochDay(today);
  if (dt <= dl) return prevStreak;
  if (bridgesOnlyWeekend(lastDate, today)) return prevStreak + 1;
  return 1;
}

/**
 * Streak historis dari daftar tanggal check-in "YYYY-MM-DD" (asc, distinct).
 * Dipakai backfill untuk merekonsiliasi streak yang sudah diraih.
 */
export function computeHistoricalStreak(dates: string[]): {
  current: number;
  longest: number;
} {
  let current = 0;
  let longest = 0;
  let last: string | null = null;
  for (const d of dates) {
    current = nextStreak(current, last, d);
    last = d;
    if (current > longest) longest = current;
  }
  return { current, longest };
}

/** Multiplier XP untuk check-in on-time berdasarkan streak (ber-cap). */
export function streakMultiplier(streak: number): number {
  for (const tier of STREAK_MULTIPLIER_TIERS) {
    if (streak >= tier.minStreak) {
      return Math.min(tier.multiplier, STREAK_MULTIPLIER_CAP);
    }
  }
  return 1;
}

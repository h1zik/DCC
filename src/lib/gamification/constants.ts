/**
 * Konstanta terpusat & tunable untuk engine gamifikasi. Ubah di sini untuk
 * men-tuning ekonomi XP tanpa menyentuh logika. Semua dipin oleh unit test.
 */

/* ── Zona waktu & cutoff absensi ──────────────────────────────────────────── */

export const ATTENDANCE_TZ = "Asia/Jakarta";

/**
 * Batas jam check-in dianggap "tepat waktu" (wall-clock Asia/Jakarta, "HH:mm").
 * = jam masuk 09:00 + toleransi 15 menit. Override via env ATTENDANCE_ONTIME_CUTOFF.
 */
export const ATTENDANCE_ONTIME_CUTOFF =
  process.env.ATTENDANCE_ONTIME_CUTOFF?.trim() || "09:15";

/* ── Nilai XP dasar (outcome-based) ───────────────────────────────────────── */

export const XP = {
  /** XP dasar per verified check-in (dikali streak multiplier bila on-time). */
  CHECKIN_BASE: 10,
  /** XP tugas selesai ≤ tenggat (first close only). */
  TASK_ONTIME: 25,
  /** XP kesegaran data per modul per ISO-week. */
  DATA_FRESH: 15,
  /** XP milestone tenure per 30 hari. */
  TENURE_ANNIVERSARY: 50,
} as const;

/* ── Streak multiplier (bertingkat, ber-cap) ──────────────────────────────── */

/**
 * Tier multiplier untuk XP check-in ON-TIME, dari streak tertinggi ke terendah.
 * Streak = jumlah hari kerja beruntun dengan verified check-in.
 */
export const STREAK_MULTIPLIER_TIERS: ReadonlyArray<{
  minStreak: number;
  multiplier: number;
}> = [
  { minStreak: 14, multiplier: 2.0 },
  { minStreak: 7, multiplier: 1.5 },
  { minStreak: 3, multiplier: 1.25 },
  { minStreak: 0, multiplier: 1.0 },
];

/** Batas atas multiplier (guard anti-inflasi). */
export const STREAK_MULTIPLIER_CAP = 2.0;

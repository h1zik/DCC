/**
 * Utilitas waktu untuk gamifikasi. Konversi timestamp UTC → wall-clock
 * Asia/Jakarta (jangan pernah bandingkan UTC mentah untuk "tepat waktu").
 */
import { ATTENDANCE_TZ } from "./constants";

const HHMM = new Intl.DateTimeFormat("en-GB", {
  timeZone: ATTENDANCE_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Wall-clock lokal Jakarta sebagai "HH:mm" (24 jam, zero-padded). */
export function jakartaClock(timestamp: Date): string {
  const parts = HHMM.formatToParts(timestamp);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

/** Jam lokal Jakarta (0–23). */
export function jakartaHour(timestamp: Date): number {
  return Number(jakartaClock(timestamp).slice(0, 2));
}

const YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: ATTENDANCE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Hari kalender lokal Jakarta sebagai "YYYY-MM-DD" (konsisten dgn Attendance.date). */
export function jakartaDateString(timestamp: Date): string {
  return YMD.format(timestamp); // en-CA → "YYYY-MM-DD"
}

/**
 * True bila check-in tepat waktu: wall-clock Jakarta ≤ cutoff ("HH:mm").
 * String-compare aman karena keduanya "HH:mm" 24 jam zero-padded.
 */
export function isOnTimeCheckIn(timestamp: Date, cutoff: string): boolean {
  return jakartaClock(timestamp) <= cutoff;
}

/**
 * Kunci ISO-week "YYYY-Www" (UTC) untuk dedupe XP kesegaran data mingguan.
 * Berbasis algoritma ISO-8601 (minggu berisi Kamis pertama tahun tsb).
 */
export function isoWeekKey(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // Kamis pada minggu ini menentukan tahun ISO.
  const dayNum = (d.getUTCDay() + 6) % 7; // Senin=0 … Minggu=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/**
 * Rentang ISO-week (Senin 00:00 UTC → Senin berikutnya) yang memuat `ref`.
 * Dipakai untuk query "modul di-update minggu ini" pada XP kesegaran data.
 */
export function isoWeekRange(ref: Date): { start: Date; end: Date } {
  const d = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()),
  );
  const dayNum = (d.getUTCDay() + 6) % 7; // Senin=0 … Minggu=6
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - dayNum);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

/**
 * Aritmetika hari untuk kalender ruangan. Semua tanggal dipegang sebagai kunci
 * "YYYY-MM-DD" dan dihitung di UTC, jadi hasilnya sama di server dan peramban
 * (tidak bergantung zona waktu mesin). Murni, aman dipakai klien.
 *
 * Waktu acara (DateTime) diterjemahkan ke hari WIB lewat `@/lib/kol/time`;
 * tanggal campaign (`@db.Date`) lewat `dateOnlyKey`.
 */

export type DayKey = string;

const DAY_MS = 86_400_000;
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== "string" || !DAY_KEY_RE.test(value)) return false;
  return dayKeyFromUtc(keyToUtcDate(value)) === value;
}

/** Kunci hari → Date pada tengah malam UTC (bentuk yang disimpan `@db.Date`). */
export function keyToUtcDate(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

function dayKeyFromUtc(date: Date): DayKey {
  return date.toISOString().slice(0, 10);
}

/** Nilai `@db.Date` (Date atau ISO string) → kunci hari. */
export function dateOnlyKey(value: Date | string): DayKey {
  const d = typeof value === "string" ? new Date(value) : value;
  return dayKeyFromUtc(d);
}

export function makeDayKey(year: number, monthIndex: number, day: number): DayKey {
  return dayKeyFromUtc(new Date(Date.UTC(year, monthIndex, day)));
}

export function addDaysKey(key: DayKey, days: number): DayKey {
  return dayKeyFromUtc(new Date(keyToUtcDate(key).getTime() + days * DAY_MS));
}

/** Selisih hari `to - from` (positif bila `to` lebih akhir). */
export function diffDays(from: DayKey, to: DayKey): number {
  return Math.round((keyToUtcDate(to).getTime() - keyToUtcDate(from).getTime()) / DAY_MS);
}

/** 0 = Senin … 6 = Minggu. */
export function weekdayIndex(key: DayKey): number {
  return (keyToUtcDate(key).getUTCDay() + 6) % 7;
}

export function startOfWeekKey(key: DayKey): DayKey {
  return addDaysKey(key, -weekdayIndex(key));
}

/** "YYYY-MM" dari kunci hari. */
export function monthKeyOf(key: DayKey): string {
  return key.slice(0, 7);
}

export function firstDayOfMonth(monthKey: string): DayKey {
  return `${monthKey}-01`;
}

export function lastDayOfMonth(monthKey: string): DayKey {
  const [y, m] = monthKey.split("-").map(Number);
  return dayKeyFromUtc(new Date(Date.UTC(y!, m!, 0)));
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  return dayKeyFromUtc(new Date(Date.UTC(y!, m! - 1 + delta, 1))).slice(0, 7);
}

/**
 * Grid bulan: selalu 6 minggu × 7 hari mulai Senin, supaya tinggi grid tidak
 * melompat saat pindah bulan.
 */
export function monthGrid(monthKey: string): DayKey[][] {
  const start = startOfWeekKey(firstDayOfMonth(monthKey));
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDaysKey(start, w * 7 + d)),
  );
}

export function eachDayKey(from: DayKey, to: DayKey): DayKey[] {
  const count = diffDays(from, to);
  if (count < 0) return [];
  return Array.from({ length: count + 1 }, (_, i) => addDaysKey(from, i));
}

export function minKey(a: DayKey, b: DayKey): DayKey {
  return a <= b ? a : b;
}

export function maxKey(a: DayKey, b: DayKey): DayKey {
  return a >= b ? a : b;
}

export function rangesOverlap(
  aStart: DayKey,
  aEnd: DayKey,
  bStart: DayKey,
  bEnd: DayKey,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function fmt(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const id = JSON.stringify(options);
  let f = fmtCache.get(id);
  if (!f) {
    f = new Intl.DateTimeFormat("id-ID", { ...options, timeZone: "UTC" });
    fmtCache.set(id, f);
  }
  return f;
}

/** "12 Nov" */
export function formatDayShort(key: DayKey): string {
  return fmt({ day: "numeric", month: "short" }).format(keyToUtcDate(key));
}

/** "Kamis, 12 November 2026" */
export function formatDayLong(key: DayKey): string {
  return fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    keyToUtcDate(key),
  );
}

/** "Kamis, 12 November" */
export function formatDayMedium(key: DayKey): string {
  return fmt({ weekday: "long", day: "numeric", month: "long" }).format(keyToUtcDate(key));
}

/** "November 2026" */
export function formatMonthLong(monthKey: string): string {
  return fmt({ month: "long", year: "numeric" }).format(keyToUtcDate(firstDayOfMonth(monthKey)));
}

/** "Nov" atau "Nov 2027" bila `withYear`. */
export function formatMonthShort(monthKey: string, withYear = false): string {
  return fmt(withYear ? { month: "short", year: "numeric" } : { month: "short" }).format(
    keyToUtcDate(firstDayOfMonth(monthKey)),
  );
}

/** "3–11 Nov", "28 Nov – 5 Des", atau "28 Des 2026 – 3 Jan 2027". */
export function formatDayRange(start: DayKey, end: DayKey): string {
  if (start === end) return formatDayShort(start);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  if (!sameYear) {
    const full = fmt({ day: "numeric", month: "short", year: "numeric" });
    return `${full.format(keyToUtcDate(start))} – ${full.format(keyToUtcDate(end))}`;
  }
  if (monthKeyOf(start) === monthKeyOf(end)) {
    return `${Number(start.slice(8))}–${formatDayShort(end)}`;
  }
  return `${formatDayShort(start)} – ${formatDayShort(end)}`;
}

/** Hitung mundur gaya tim marketing: "Hari ini", "Besok", "H-12". */
export function countdownLabel(today: DayKey, target: DayKey): string {
  const n = diffDays(today, target);
  if (n === 0) return "Hari ini";
  if (n === 1) return "Besok";
  if (n > 1) return `H-${n}`;
  return `H+${-n}`;
}

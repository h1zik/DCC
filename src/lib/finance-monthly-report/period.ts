const JAKARTA_OFFSET_MS = 7 * 3_600_000;

export type YearMonth = { year: number; month: number };

/** Tanggal kalender Jakarta (WIB, tanpa DST) dari sebuah instant. */
export function jakartaToday(
  now: Date = new Date(),
): YearMonth & { day: number } {
  const d = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

export function monthIndex(p: YearMonth): number {
  return p.year * 12 + (p.month - 1);
}

export function fromMonthIndex(index: number): YearMonth {
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** `count` bulan terakhir, terbaru dulu, berakhir di `current`. */
export function recentMonths(current: YearMonth, count: number): YearMonth[] {
  const end = monthIndex(current);
  return Array.from({ length: count }, (_, i) => fromMonthIndex(end - i));
}

/**
 * Bulan yang dipraseleksi di dialog: bulan yang sedang dilihat — kecuali itu
 * bulan berjalan dan masih awal bulan (≤ tgl 5), saat laporan yang lazim
 * dibuat adalah bulan yang baru ditutup.
 */
export function defaultReportMonth(
  viewed: YearMonth,
  now: Date = new Date(),
): YearMonth {
  const today = jakartaToday(now);
  const current = monthIndex(today);
  const clamped = Math.min(monthIndex(viewed), current);
  if (clamped === current && today.day <= 5) return fromMonthIndex(current - 1);
  return fromMonthIndex(clamped);
}

/**
 * Helper tanggal GSC (pure, bisa dipakai client & test).
 *
 * Data Search Console punya lag ~2 hari dan `SeoGscDaily.date` disimpan
 * sebagai tanggal murni (T00:00:00Z). Semua jendela perbandingan karena itu
 * dihitung berbasis tanggal (bukan timestamp `now - N hari`) dan dijangkar
 * pada hari terakhir yang datanya final (`GSC_LAG_DAYS` hari lalu).
 */

export const GSC_LAG_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD (UTC) untuk `daysAgo` hari sebelum `now`. */
export function gscDateFrom(now: number, daysAgo: number): string {
  return new Date(now - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

export type GscDateWindow = {
  /** YYYY-MM-DD inklusif. */
  start: string;
  /** YYYY-MM-DD inklusif. */
  end: string;
};

export type GscWindows = {
  current: GscDateWindow;
  previous: GscDateWindow;
  days: number;
};

/**
 * Jendela "kini" dan "sebelumnya" masing-masing tepat `days` hari, berurutan
 * tanpa tumpang tindih, berakhir di `GSC_LAG_DAYS` hari lalu.
 *   current  = [lag + days − 1 .. lag]
 *   previous = [lag + 2·days − 1 .. lag + days]
 */
export function gscWindows(now: number = Date.now(), days = 28): GscWindows {
  const lag = GSC_LAG_DAYS;
  return {
    days,
    current: {
      start: gscDateFrom(now, lag + days - 1),
      end: gscDateFrom(now, lag),
    },
    previous: {
      start: gscDateFrom(now, lag + days * 2 - 1),
      end: gscDateFrom(now, lag + days),
    },
  };
}

/** Batas `Date` untuk query Prisma pada kolom tanggal murni (T00:00:00Z). */
export function gscWindowBounds(win: GscDateWindow): { gte: Date; lte: Date } {
  return {
    gte: new Date(`${win.start}T00:00:00Z`),
    lte: new Date(`${win.end}T00:00:00Z`),
  };
}

/** Jumlah hari inklusif dalam satu jendela (untuk test/sanity check). */
export function windowDayCount(win: GscDateWindow): number {
  const a = Date.parse(`${win.start}T00:00:00Z`);
  const b = Date.parse(`${win.end}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS) + 1;
}

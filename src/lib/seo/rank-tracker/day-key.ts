/**
 * Kunci hari (YYYY-MM-DD) dalam zona WIB (Asia/Jakarta, UTC+7, tanpa DST).
 * Dihitung aritmetis — tidak bergantung pada ketersediaan Intl/ICU di runtime,
 * sehingga hasilnya identik di server, cron, maupun test.
 */

export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** YYYY-MM-DD menurut kalender WIB. */
export function wibDayKey(date: Date | string | number): string {
  const t = typeof date === "number" ? date : new Date(date).getTime();
  const shifted = new Date(t + WIB_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(
    shifted.getUTCDate(),
  )}`;
}

/** Instan UTC saat hari WIB yang memuat `date` dimulai (00:00 WIB). */
export function startOfWibDay(date: Date | string | number): Date {
  const t = typeof date === "number" ? date : new Date(date).getTime();
  const shifted = t + WIB_OFFSET_MS;
  const dayStartShifted = Math.floor(shifted / DAY_MS) * DAY_MS;
  return new Date(dayStartShifted - WIB_OFFSET_MS);
}

export function isSameWibDay(
  a: Date | string | number,
  b: Date | string | number,
): boolean {
  return wibDayKey(a) === wibDayKey(b);
}

/**
 * Daftar kunci hari WIB berurutan naik, `days` hari terakhir termasuk hari
 * yang memuat `now`.
 */
export function wibDayKeyRange(days: number, now: Date | number = Date.now()): string[] {
  const start = startOfWibDay(now).getTime();
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    out.push(wibDayKey(start - i * DAY_MS));
  }
  return out;
}

/**
 * Helper tanggal untuk modul finance — SEMUA berbasis UTC.
 *
 * `entryDate` tersimpan sebagai UTC-midnight (input `type="date"` di-parse
 * `new Date("YYYY-MM-DD")` = 00:00Z). Pembentukan rentang periode dan
 * pengecekan kunci periode harus memakai komponen UTC juga — dulu campuran
 * `setHours`/`new Date(y, m-1, 1)`/`getMonth()` lokal-server yang hanya
 * kebetulan benar bila server berjalan di TZ UTC.
 */

/** Tanggal murni (00:00:00.000Z) dari komponen UTC sebuah Date. */
export function utcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Akhir hari UTC (23:59:59.999Z). */
export function utcEndOfDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999),
  );
}

/** Awal bulan UTC. `month` 1–12 (nilai di luar itu di-normalisasi Date.UTC). */
export function utcMonthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

/** Akhir bulan UTC (hari terakhir bulan tsb, 23:59:59.999Z). */
export function utcMonthEnd(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

/**
 * Akhir bulan SEBELUM `asOf` — pengganti pola `setMonth(getMonth()-1)` yang
 * rollover untuk tanggal 29–31 (31 Juli - 1 bulan = "31 Juni" = 1 Juli).
 */
export function utcPreviousMonthEnd(asOf: Date): Date {
  return new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 0, 23, 59, 59, 999),
  );
}

/** (tahun, bulan 1–12) menurut UTC — untuk pengecekan kunci periode. */
export function utcYearMonth(d: Date): { year: number; month: number } {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

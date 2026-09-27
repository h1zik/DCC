/**
 * Waktu tayang KOL disimpan UTC, dimasukkan & ditampilkan dalam WIB (UTC+7,
 * tanpa DST). Murni — aman dipakai klien.
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** "2026-10-02T19:00" (WIB) → Date UTC. */
export function wibInputToDate(value: string): Date {
  const d = new Date(`${value}:00+07:00`);
  if (Number.isNaN(d.getTime())) throw new Error("Tanggal tayang tidak valid.");
  return d;
}

/** Date → "2026-10-02T19:00" (WIB) untuk `<input type="datetime-local">`. */
export function dateToWibInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 16);
}

/** Kunci hari WIB "YYYY-MM-DD" — dipakai kalender. */
export function wibDayKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

const dateTimeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatWibDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return `${dateTimeFmt.format(new Date(date))} WIB`;
}

export function formatWibDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return dateFmt.format(new Date(date));
}

export function formatWibTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return timeFmt.format(new Date(date));
}

/** "YYMM" menurut WIB — dipakai penomoran order. */
export function wibYearMonthKey(date: Date = new Date()): string {
  const iso = new Date(date.getTime() + WIB_OFFSET_MS).toISOString();
  return `${iso.slice(2, 4)}${iso.slice(5, 7)}`;
}

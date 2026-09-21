import { formatIdrShort } from "@/lib/finance-format";

const NUM_ID = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const PCT_ID = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const EN_DASH = "–";

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Nominal gaya laporan akuntansi: pemisah ribuan id-ID, negatif dalam kurung,
 * nol sebagai en dash. Tanpa "Rp" (satuan ditulis di judul tabel).
 */
export function fmtMoney(
  value: string | number | null | undefined,
  opts: { zeroDash?: boolean; withRp?: boolean } = {},
): string {
  const { zeroDash = true, withRp = false } = opts;
  const n = Math.round(toNumber(value));
  if (n === 0) return zeroDash ? EN_DASH : withRp ? "Rp 0" : "0";
  const body = NUM_ID.format(Math.abs(n));
  const text = withRp ? `Rp ${body}` : body;
  return n < 0 ? `(${text})` : text;
}

/** Nominal ringkas untuk kartu KPI ("Rp 12,5 Jt"). */
export function fmtMoneyShort(
  value: string | number | null | undefined,
): string {
  const n = toNumber(value);
  if (n === 0) return "Rp 0";
  return formatIdrShort(n).replace(/(\d)\.(\d)/, "$1,$2");
}

/** "12,4%" — tanpa tanda. */
export function fmtPct(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return EN_DASH;
  return `${PCT_ID.format(Math.abs(p))}%`;
}

/**
 * Perubahan bertanda untuk chip/kolom "%": "+12,4%", "−3,0%", ">999%",
 * "baru" bila tak ada pembanding (periode lalu 0).
 */
export function fmtDeltaPct(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "baru";
  if (p === 0) return "0,0%";
  const sign = p > 0 ? "+" : "−";
  if (Math.abs(p) > 999) return `${sign}>999%`;
  return `${sign}${PCT_ID.format(Math.abs(p))}%`;
}

/** Persentase perubahan; null bila pembanding 0 (tak terdefinisi), 0 bila keduanya 0. */
export function pctChange(
  current: string | number,
  previous: string | number,
): number | null {
  const c = toNumber(current);
  const p = toNumber(previous);
  if (p === 0) return c === 0 ? 0 : null;
  return ((c - p) / Math.abs(p)) * 100;
}

/** "30 Sep 2026" — komponen UTC (entryDate & batas periode tersimpan UTC). */
export function fmtDateUtc(iso: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/** "21 Sep 2026 14.05 WIB" — cap waktu cetak. */
export function fmtDateTimeJakarta(iso: string | Date): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(d);
  const time = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(d);
  return `${date} ${time} WIB`;
}

/** Escape HTML untuk teks MAUPUN nilai atribut. */
export function escHtml(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Literal string CSS (untuk `content:` pada margin box @page). `<` di-escape
 * juga agar nilai tidak bisa menutup tag <style>.
 */
export function cssString(value: string): string {
  const body = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/</g, "\\3c ")
    .replace(/[\r\n\f]+/g, " ");
  return `"${body}"`;
}

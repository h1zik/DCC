/** Format angka KOL Hub — murni, aman untuk klien. */

const idrFull = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** "Rp 1.250.000" */
export function rupiah(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return idrFull.format(value);
}

/** "Rp 1,3 jt" / "Rp 750 rb" — untuk angka di chip & ringkasan. */
export function rupiahShort(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  const fmt = (n: number, d: number) =>
    n.toLocaleString("id-ID", { maximumFractionDigits: d });
  if (abs >= 1_000_000_000) return `${sign}Rp ${fmt(abs / 1_000_000_000, 2)} M`;
  if (abs >= 1_000_000) return `${sign}Rp ${fmt(abs / 1_000_000, 1)} jt`;
  if (abs >= 1_000) return `${sign}Rp ${fmt(abs / 1_000, 0)} rb`;
  return `${sign}Rp ${fmt(abs, 0)}`;
}

/**
 * Angka ringkas (12,3rb / 1,2jt). Salinan server-safe dari helper Brand Hub —
 * yang itu tinggal di modul "use client" sehingga tidak bisa dipanggil dari
 * server component.
 */
export function compactCount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}rb`;
  }
  return Math.round(value).toLocaleString("id-ID");
}

/** Ketik "1.500.000" / "1500000" → "1500000" (string angka mentah). */
export function parseRupiahInput(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

/** "1500000" → "1.500.000" untuk tampilan di input. */
export function formatRupiahInput(raw: string): string {
  const digits = parseRupiahInput(raw);
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}

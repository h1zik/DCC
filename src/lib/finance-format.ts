import { FinanceLedgerType } from "@prisma/client";

export const FINANCE_TYPE_LABEL: Record<FinanceLedgerType, string> = {
  ASSET: "Aktiva",
  LIABILITY: "Kewajiban",
  EQUITY: "Ekuitas",
  REVENUE: "Pendapatan",
  EXPENSE: "Beban",
};

export const FINANCE_TYPE_GROUP_ORDER: FinanceLedgerType[] = [
  FinanceLedgerType.ASSET,
  FinanceLedgerType.LIABILITY,
  FinanceLedgerType.EQUITY,
  FinanceLedgerType.REVENUE,
  FinanceLedgerType.EXPENSE,
];

/** Sisi naturalnya pada Trial Balance / Buku Besar. */
export function isDebitNormal(t: FinanceLedgerType): boolean {
  return t === FinanceLedgerType.ASSET || t === FinanceLedgerType.EXPENSE;
}

/** Pewarnaan tipe akun di chip/badge — konsisten di seluruh modul. */
export const FINANCE_TYPE_TONE: Record<
  FinanceLedgerType,
  { dot: string; chip: string; subtotal: string }
> = {
  ASSET: {
    dot: "bg-sky-500",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    subtotal: "text-sky-700 dark:text-sky-300",
  },
  LIABILITY: {
    dot: "bg-rose-500",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    subtotal: "text-rose-700 dark:text-rose-300",
  },
  EQUITY: {
    dot: "bg-violet-500",
    chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    subtotal: "text-violet-700 dark:text-violet-300",
  },
  REVENUE: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    subtotal: "text-emerald-700 dark:text-emerald-300",
  },
  EXPENSE: {
    dot: "bg-amber-500",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    subtotal: "text-amber-700 dark:text-amber-300",
  },
};

/**
 * Format mata uang IDR ringkas (mis. "Rp 12,5 Jt"). Berguna di KPI cards
 * & ringkasan; untuk tabel akuntansi pakai `formatIdr` (penuh).
 */
export function formatIdrShort(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 1 : 2)} M`;
  if (abs >= 1_000_000)
    return `${sign}Rp ${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)} Jt`;
  if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(0)} rb`;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Format nominal IDR penuh tanpa simbol (untuk kolom debit/kredit). */
export function formatIdrPlain(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n === 0) return "—";
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(n);
}

/** Persentase, dengan tanda eksplisit. */
export function formatSignedPercent(p: number | null | undefined): string {
  if (p == null) return "—";
  const sign = p > 0 ? "+" : p < 0 ? "" : "";
  return `${sign}${p.toFixed(p >= 100 ? 0 : 1)}%`;
}

/** Format tanggal pendek "dd MMM yyyy" dalam bahasa Indonesia. */
export function formatDateId(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Format tanggal pendek "dd MMM" dalam bahasa Indonesia (tanpa tahun). */
export function formatDateShortId(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(d);
}

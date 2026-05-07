export const FINANCE_MONTH_LABELS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export function periodLabel(year: number, month: number): string {
  const idx = Math.min(12, Math.max(1, month)) - 1;
  return `${FINANCE_MONTH_LABELS[idx]} ${year}`;
}

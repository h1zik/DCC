import { Prisma } from "@prisma/client";
import type { TrendPoint } from "./types";

export type TrendRawRow = {
  /** "YYYY-MM" */
  ym: string;
  type: "REVENUE" | "EXPENSE";
  debit: string;
  credit: string;
};

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

export function shortMonthLabel(year: number, month: number): string {
  return `${SHORT_MONTHS[month - 1]} ${String(year).slice(2)}`;
}

/**
 * Susun `months` titik berurutan (terlama → terbaru) yang berakhir di
 * (endYear, endMonth); bulan tanpa transaksi diisi nol.
 * Pendapatan = kredit − debit, beban = debit − kredit.
 */
export function fillTrendMonths(
  rows: TrendRawRow[],
  endYear: number,
  endMonth: number,
  months: number,
): TrendPoint[] {
  const byKey = new Map<
    string,
    { revenue: Prisma.Decimal; expense: Prisma.Decimal }
  >();
  for (const r of rows) {
    const cur = byKey.get(r.ym) ?? {
      revenue: new Prisma.Decimal(0),
      expense: new Prisma.Decimal(0),
    };
    const debit = new Prisma.Decimal(r.debit);
    const credit = new Prisma.Decimal(r.credit);
    if (r.type === "REVENUE")
      cur.revenue = cur.revenue.plus(credit).minus(debit);
    else cur.expense = cur.expense.plus(debit).minus(credit);
    byKey.set(r.ym, cur);
  }

  const points: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(endYear, endMonth - 1 - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const v = byKey.get(`${year}-${String(month).padStart(2, "0")}`);
    const revenue = v?.revenue ?? new Prisma.Decimal(0);
    const expense = v?.expense ?? new Prisma.Decimal(0);
    points.push({
      year,
      month,
      label: shortMonthLabel(year, month),
      revenue: revenue.toString(),
      expense: expense.toString(),
      net: revenue.minus(expense).toString(),
    });
  }
  return points;
}

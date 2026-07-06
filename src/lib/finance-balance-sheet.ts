import { Prisma } from "@prisma/client";

/**
 * Total & identitas neraca (A = L + E) dihitung dengan Decimal — dipakai
 * server sebelum serialisasi agar klien tidak menghitung ulang dengan float
 * (badge "seimbang" harus eksak, bukan toleransi pembulatan).
 */
export function computeBalanceSheetTotals(input: {
  assets: { amount: Prisma.Decimal }[];
  liabilities: { amount: Prisma.Decimal }[];
  equity: { amount: Prisma.Decimal }[];
  retainedEarnings: Prisma.Decimal;
}) {
  const sum = (rows: { amount: Prisma.Decimal }[]) =>
    rows.reduce((s, r) => s.plus(r.amount), new Prisma.Decimal(0));

  const totalAssets = sum(input.assets);
  const totalLiabilities = sum(input.liabilities);
  const totalEquity = sum(input.equity).plus(input.retainedEarnings);
  const difference = totalAssets.minus(totalLiabilities.plus(totalEquity));

  return {
    totalAssets,
    totalLiabilities,
    totalEquity,
    /** Selisih eksak A − (L + E); nol = seimbang. */
    difference,
    isBalanced: difference.isZero(),
  };
}

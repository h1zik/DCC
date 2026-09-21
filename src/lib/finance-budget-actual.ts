import "server-only";

import { FinanceLedgerType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { utcMonthEnd, utcMonthStart } from "@/lib/finance-dates";
import { signedBalanceForAccount, zeroDecimal } from "@/lib/finance-money";

export type BudgetVsActualRow = {
  budgetId: string;
  label: string;
  brandId: string | null;
  accountId: string | null;
  limit: Prisma.Decimal;
  actual: Prisma.Decimal;
  variance: Prisma.Decimal;
};

/**
 * Budget vs aktual satu bulan — SATU implementasi untuk halaman Anggaran, PDF
 * bulanan, MCP `get_budget_vs_actual`, dan dashboard CEO. Dulu ada dua versi:
 * halaman memakai batas bulan UTC, jalur AI/CEO memakai jam lokal server,
 * sehingga aktual bulan yang sama bisa berbeda.
 *
 * Tanpa pengecekan peran — pemanggil yang bertanggung jawab atas otorisasi.
 * Agregasi di DB (groupBy akun×brand), bukan memuat semua baris jurnal.
 *
 * `brandId` membatasi ke baris budget milik brand itu saja.
 */
export async function computeBudgetVsActual(input: {
  year: number;
  month: number;
  brandId?: string | null;
}): Promise<BudgetVsActualRow[]> {
  const start = utcMonthStart(input.year, input.month);
  const end = utcMonthEnd(input.year, input.month);

  const [budgets, grouped] = await Promise.all([
    prisma.financeBudgetLine.findMany({
      where: {
        year: input.year,
        month: input.month,
        ...(input.brandId ? { brandId: input.brandId } : {}),
      },
      include: { brand: true, account: true },
    }),
    prisma.financeJournalLine.groupBy({
      by: ["accountId", "brandId"],
      where: {
        entry: { status: "POSTED", entryDate: { gte: start, lte: end } },
        account: { type: FinanceLedgerType.EXPENSE },
      },
      _sum: { debitBase: true, creditBase: true },
    }),
  ]);

  return budgets.map((b) => {
    let actual = zeroDecimal();
    for (const g of grouped) {
      if (b.accountId && g.accountId !== b.accountId) continue;
      if (b.brandId && g.brandId !== b.brandId) continue;
      actual = actual.plus(
        signedBalanceForAccount(
          FinanceLedgerType.EXPENSE,
          g._sum.debitBase ?? zeroDecimal(),
          g._sum.creditBase ?? zeroDecimal(),
        ),
      );
    }
    return {
      budgetId: b.id,
      label: [
        b.account?.code ?? "SEMUA_BEBAN",
        b.brand?.name ?? "Semua brand",
      ].join(" · "),
      brandId: b.brandId,
      accountId: b.accountId,
      limit: b.amountLimit,
      actual,
      variance: b.amountLimit.minus(actual),
    };
  });
}

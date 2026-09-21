import "server-only";
import {
  FinanceJournalStatus,
  FinanceLedgerType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  reportBalanceSheetComparison,
  reportProfitLoss,
  reportTaxBuckets,
} from "@/actions/finance-reports";
import { financeBudgetVsActual } from "@/actions/finance-budget";
import { buildCashFlowStatement } from "@/lib/finance-cashflow";
import { buildTrialBalance } from "@/lib/finance-trial-balance";
import { getAppBranding } from "@/lib/app-branding";
import {
  utcDateOnly,
  utcEndOfDay,
  utcMonthEnd,
  utcMonthStart,
} from "@/lib/finance-dates";
import { periodLabel } from "@/lib/finance-period";
import { bucketAging } from "./aging";
import { pctChange } from "./format";
import { buildMonthlyHighlights } from "./highlights";
import {
  loadBrandPnl,
  loadCashPositions,
  loadMonthlyTrend,
  loadOpenApAr,
} from "./queries";
import type {
  BalanceSheetSide,
  MoneyPair,
  MonthlyReportData,
  MonthlyReportInput,
  ProfitLossRow,
} from "./types";

const TREND_MONTHS = 6;
const TOP_EXPENSES = 5;
const JAKARTA_OFFSET_MS = 7 * 3_600_000;

type Dec = Prisma.Decimal;

function pair(current: Dec, previous: Dec): MoneyPair {
  return {
    current: current.toString(),
    previous: previous.toString(),
    deltaPct: pctChange(current.toString(), previous.toString()),
  };
}

function marginPct(net: Dec, revenue: Dec): number | null {
  if (revenue.lte(0)) return null;
  return Number(net.div(revenue).times(100).toString());
}

type BsResult = Awaited<
  ReturnType<typeof reportBalanceSheetComparison>
>["current"];

function serializeBs(bs: BsResult): BalanceSheetSide {
  const lines = (rows: { code: string; name: string; amount: Dec }[]) =>
    [...rows]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((r) => ({
        code: r.code,
        name: r.name,
        amount: r.amount.toString(),
      }));
  return {
    assets: lines(bs.assets),
    liabilities: lines(bs.liabilities),
    equity: lines(bs.equity),
    retainedEarnings: bs.retainedEarnings.toString(),
    totalAssets: bs.totalAssets.toString(),
    totalLiabilities: bs.totalLiabilities.toString(),
    totalEquity: bs.totalEquity.toString(),
    difference: bs.difference.toString(),
    isBalanced: bs.isBalanced,
  };
}

/**
 * Kumpulkan seluruh angka Laporan Keuangan Bulanan menjadi satu DTO polos.
 *
 * Pembanding = BULAN KALENDER sebelumnya (bukan `reportProfitLossComparison`,
 * yang menggeser berdasarkan panjang periode sehingga Sep dibandingkan dengan
 * "2–31 Agu"). KPI diturunkan dari laporan yang sama agar kartu = total tabel.
 */
export async function composeMonthlyFinanceReport(
  input: MonthlyReportInput,
  ctx: { generatedByName: string | null; now?: Date },
): Promise<MonthlyReportData> {
  const { year, month } = input;
  const brandId = input.brandId ?? null;
  const now = ctx.now ?? new Date();

  // "Hari ini" menurut kalender Jakarta, direpresentasikan sebagai tanggal UTC
  // (selaras dengan entryDate/dueDate yang tersimpan UTC-midnight).
  const today = utcDateOnly(new Date(now.getTime() + JAKARTA_OFFSET_MS));
  const from = utcMonthStart(year, month);
  const to = utcMonthEnd(year, month);
  const isInProgress =
    today.getUTCFullYear() === year && today.getUTCMonth() + 1 === month;
  const effectiveTo = isInProgress ? utcEndOfDay(today) : to;
  const prevFrom = utcMonthStart(year, month - 1);
  const prevTo = utcMonthEnd(year, month - 1);

  // buildCashFlowStatement/buildTrialBalance menghitung batas hari dengan
  // setHours LOKAL — beri tanggal murni agar tidak bergeser ke hari berikutnya
  // pada server non-UTC.
  const effectiveDay = utcDateOnly(effectiveTo);

  const [
    plCurr,
    plPrev,
    bs,
    cfCurr,
    cfPrev,
    tb,
    tax,
    budgetRows,
    trend,
    brandPnlRows,
    cashPositions,
    openDocs,
    lock,
    draftJournalCount,
    postedJournalCount,
    brand,
    branding,
    expenseAccounts,
  ] = await Promise.all([
    reportProfitLoss({ from, to: effectiveTo, brandId }),
    reportProfitLoss({ from: prevFrom, to: prevTo, brandId }),
    reportBalanceSheetComparison({ asOf: effectiveTo, brandId }),
    buildCashFlowStatement({ from, to: effectiveDay, brandId }),
    buildCashFlowStatement({
      from: prevFrom,
      to: utcDateOnly(prevTo),
      brandId,
    }),
    buildTrialBalance({ asOf: effectiveDay, brandId, hideZero: true }),
    reportTaxBuckets({ from, to: effectiveTo, brandId }),
    financeBudgetVsActual({ year, month }),
    loadMonthlyTrend({
      endYear: year,
      endMonth: month,
      months: TREND_MONTHS,
      brandId,
      upTo: effectiveTo,
    }),
    brandId ? Promise.resolve([]) : loadBrandPnl({ from, to: effectiveTo }),
    loadCashPositions({ asOf: effectiveTo, brandId }),
    loadOpenApAr(),
    prisma.financePeriodLock.findUnique({
      where: { year_month: { year, month } },
      include: { lockedBy: { select: { name: true } } },
    }),
    prisma.financeJournalEntry.count({
      where: {
        status: FinanceJournalStatus.DRAFT,
        entryDate: { gte: from, lte: to },
      },
    }),
    prisma.financeJournalEntry.count({
      where: {
        status: FinanceJournalStatus.POSTED,
        entryDate: { gte: from, lte: effectiveTo },
      },
    }),
    brandId
      ? prisma.brand.findUnique({
          where: { id: brandId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    getAppBranding(),
    prisma.financeLedgerAccount.findMany({
      where: { type: FinanceLedgerType.EXPENSE },
      select: { code: true, name: true },
    }),
  ]);

  // ── Laba rugi: gabung baris dua bulan per tipe+kode ──────────────────────
  const plMap = new Map<string, ProfitLossRow>();
  for (const r of plCurr.rows) {
    if (
      r.type !== FinanceLedgerType.REVENUE &&
      r.type !== FinanceLedgerType.EXPENSE
    )
      continue;
    plMap.set(`${r.type}|${r.code}`, {
      code: r.code,
      name: r.name,
      type: r.type,
      current: r.amount.toString(),
      previous: "0",
    });
  }
  for (const r of plPrev.rows) {
    if (
      r.type !== FinanceLedgerType.REVENUE &&
      r.type !== FinanceLedgerType.EXPENSE
    )
      continue;
    const key = `${r.type}|${r.code}`;
    const cur = plMap.get(key);
    if (cur) cur.previous = r.amount.toString();
    else
      plMap.set(key, {
        code: r.code,
        name: r.name,
        type: r.type,
        current: "0",
        previous: r.amount.toString(),
      });
  }
  const plRows = [...plMap.values()]
    // Akun yang saling hapus hingga nol di kedua bulan hanya menambah derau.
    .filter((r) => Number(r.current) !== 0 || Number(r.previous) !== 0)
    .sort(
      (a, b) =>
        (a.type === b.type ? 0 : a.type === "REVENUE" ? -1 : 1) ||
        a.code.localeCompare(b.code),
    );

  const revenue = pair(plCurr.revenue, plPrev.revenue);
  const expense = pair(plCurr.expense, plPrev.expense);
  const net = pair(plCurr.netIncome, plPrev.netIncome);

  const topExpenses = plCurr.rows
    .filter((r) => r.type === FinanceLedgerType.EXPENSE && r.amount.gt(0))
    .sort((a, b) => b.amount.comparedTo(a.amount))
    .slice(0, TOP_EXPENSES)
    .map((r) => ({
      code: r.code,
      name: r.name,
      amount: r.amount.toString(),
      previous: plMap.get(`${r.type}|${r.code}`)?.previous ?? "0",
      sharePct: plCurr.expense.gt(0)
        ? Number(r.amount.div(plCurr.expense).times(100).toString())
        : 0,
    }));

  // ── Anggaran: label "KODE · Brand" → sertakan nama akun ──────────────────
  const expenseNameByCode = new Map(
    expenseAccounts.map((a) => [a.code, a.name]),
  );
  const budget = budgetRows.map((b) => {
    const [code, ...rest] = b.label.split(" · ");
    const accountLabel =
      code === "SEMUA_BEBAN"
        ? "Semua beban"
        : expenseNameByCode.has(code)
          ? `${code} ${expenseNameByCode.get(code)}`
          : code;
    return {
      label: [accountLabel, ...rest].join(" · "),
      limit: b.limit.toString(),
      actual: b.actual.toString(),
      variance: b.variance.toString(),
      usedPct: b.limit.gt(0)
        ? Number(b.actual.div(b.limit).times(100).toString())
        : null,
      over: b.actual.gt(b.limit),
    };
  });

  const cashAndBank = cashPositions.reduce(
    (acc, p) => acc.plus(p.balance),
    new Prisma.Decimal(0),
  );

  const data: Omit<MonthlyReportData, "highlights"> = {
    meta: {
      year,
      month,
      periodLabel: periodLabel(year, month),
      prevPeriodLabel: periodLabel(
        prevFrom.getUTCFullYear(),
        prevFrom.getUTCMonth() + 1,
      ),
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      effectiveToIso: effectiveTo.toISOString(),
      isInProgress,
      generatedAtIso: now.toISOString(),
      generatedByName: ctx.generatedByName,
      brand,
      appName: branding.appName,
      logoPath: branding.logoImagePath,
      lock: lock
        ? {
            lockedAtIso: lock.lockedAt.toISOString(),
            lockedByName: lock.lockedBy?.name ?? null,
          }
        : null,
      draftJournalCount,
      postedJournalCount,
    },
    kpis: {
      revenue,
      expense,
      net,
      marginPct: marginPct(plCurr.netIncome, plCurr.revenue),
      prevMarginPct: marginPct(plPrev.netIncome, plPrev.revenue),
      cashNet: pair(cfCurr.netCash, cfPrev.netCash),
      cashInflow: cfCurr.totalInflow.toString(),
      cashOutflow: cfCurr.totalOutflow.toString(),
      cashAndBank: cashAndBank.toString(),
    },
    profitLoss: { rows: plRows, revenue, expense, netIncome: net },
    balanceSheet: {
      asOfIso: bs.asOf.toISOString(),
      previousAsOfIso: bs.previousAsOf.toISOString(),
      current: serializeBs(bs.current),
      previous: serializeBs(bs.previous),
    },
    cashFlow: {
      totalInflow: cfCurr.totalInflow.toString(),
      totalOutflow: cfCurr.totalOutflow.toString(),
      netCash: cfCurr.netCash.toString(),
      groups: cfCurr.groups.map((g) => ({
        category: g.category,
        label: g.label,
        inflow: g.inflow.toString(),
        outflow: g.outflow.toString(),
        net: g.net.toString(),
        byCounterAccount: g.byCounterAccount.map((c) => ({
          code: c.code,
          name: c.name,
          inflow: c.inflow.toString(),
          outflow: c.outflow.toString(),
          net: c.net.toString(),
        })),
      })),
    },
    brandPnl: brandPnlRows.map((b) => ({
      id: b.id,
      name: b.name,
      revenue: b.revenue.toString(),
      expense: b.expense.toString(),
      net: b.net.toString(),
      marginPct: marginPct(b.net, b.revenue),
    })),
    budget: { rows: budget, overCount: budget.filter((b) => b.over).length },
    aging: {
      refDateIso: today.toISOString(),
      ap: bucketAging(openDocs.ap, today),
      ar: bucketAging(openDocs.ar, today),
    },
    tax: tax.rows.map((t) => ({
      code: t.code,
      label: t.label,
      amount: t.amount.toString(),
    })),
    trend,
    topExpenses,
    cashPositions: cashPositions.map((p) => ({
      code: p.code,
      name: p.name,
      bankLabel: p.bankLabel,
      balance: p.balance.toString(),
    })),
    trialBalance: {
      isBalanced: tb.isBalanced,
      totals: {
        debit: tb.totals.debit.toString(),
        credit: tb.totals.credit.toString(),
      },
      rows: tb.rows.map((r) => ({
        code: r.code,
        name: r.name,
        type: r.type,
        debit: r.debit.toString(),
        credit: r.credit.toString(),
      })),
    },
  };

  return { ...data, highlights: buildMonthlyHighlights(data) };
}

import "server-only";
import {
  FinanceApArDocStatus,
  FinanceJournalStatus,
  FinanceLedgerType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { zeroDecimal } from "@/lib/finance-money";

export type DashboardPeriod = { year: number; month: number };

export type FinanceDashboardData = Awaited<ReturnType<typeof loadFinanceDashboard>>;

const D0 = () => zeroDecimal();

function periodBounds(period: DashboardPeriod) {
  const start = new Date(period.year, period.month - 1, 1, 0, 0, 0, 0);
  const end = new Date(period.year, period.month, 0, 23, 59, 59, 999);
  const prevStart = new Date(period.year, period.month - 2, 1, 0, 0, 0, 0);
  const prevEnd = new Date(period.year, period.month - 1, 0, 23, 59, 59, 999);
  return { start, end, prevStart, prevEnd };
}

function pctChange(curr: Prisma.Decimal, prev: Prisma.Decimal): number | null {
  const p = Number(prev.toString());
  const c = Number(curr.toString());
  if (p === 0) {
    if (c === 0) return 0;
    return null;
  }
  return ((c - p) / Math.abs(p)) * 100;
}

function toDecimal(value: unknown): Prisma.Decimal {
  if (value == null) return D0();
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(String(value));
}

/**
 * Jumlahkan saldo bertanda untuk semua baris jurnal berstatus POSTED dengan
 * akun bertipe `type`. Menggunakan agregat database — tidak menarik baris
 * mentah ke memori Node.
 *
 * - ASSET / EXPENSE: signed = sum(debit) - sum(credit)
 * - LIABILITY / EQUITY / REVENUE: signed = sum(credit) - sum(debit)
 */
async function ledgerSumByType(
  type: FinanceLedgerType,
  range: { gte?: Date; lte: Date },
): Promise<Prisma.Decimal> {
  const agg = await prisma.financeJournalLine.aggregate({
    where: {
      entry: {
        status: FinanceJournalStatus.POSTED,
        entryDate: range,
      },
      account: { type },
    },
    _sum: { debitBase: true, creditBase: true },
  });
  const debit = toDecimal(agg._sum.debitBase);
  const credit = toDecimal(agg._sum.creditBase);
  switch (type) {
    case FinanceLedgerType.ASSET:
    case FinanceLedgerType.EXPENSE:
      return debit.minus(credit);
    case FinanceLedgerType.LIABILITY:
    case FinanceLedgerType.EQUITY:
    case FinanceLedgerType.REVENUE:
      return credit.minus(debit);
    default:
      return debit.minus(credit);
  }
}

/**
 * Inflow/outflow per baris arus kas: per-baris (debit - credit) dipisah
 * positif (inflow) dan negatif (outflow). Karena pemisahan bersifat per-baris,
 * dilakukan dengan single SQL `SUM(CASE WHEN ...)` agar tetap satu round-trip.
 */
async function cashFlowSums(range: { gte?: Date; lte: Date }) {
  const rows = await prisma.$queryRaw<
    Array<{ inflow: Prisma.Decimal | null; outflow: Prisma.Decimal | null }>
  >`
    SELECT
      SUM(
        CASE
          WHEN jl."debitBase" > jl."creditBase"
          THEN jl."debitBase" - jl."creditBase"
          ELSE 0
        END
      )::numeric AS inflow,
      SUM(
        CASE
          WHEN jl."debitBase" < jl."creditBase"
          THEN jl."creditBase" - jl."debitBase"
          ELSE 0
        END
      )::numeric AS outflow
    FROM "FinanceJournalLine" jl
    JOIN "FinanceJournalEntry" je ON je."id" = jl."entryId"
    JOIN "FinanceLedgerAccount" a ON a."id" = jl."accountId"
    WHERE je."status" = 'POSTED'
      AND je."entryDate" >= ${range.gte ?? new Date(0)}
      AND je."entryDate" <= ${range.lte}
      AND a."tracksCashflow" = TRUE
  `;
  const row = rows[0] ?? { inflow: null, outflow: null };
  const inflow = toDecimal(row.inflow);
  const outflow = toDecimal(row.outflow);
  return {
    inflow,
    outflow,
    net: inflow.minus(outflow),
  };
}

/**
 * Saldo total kas + bank per tanggal `asOf`. Opening balance + (debit-credit)
 * dari semua jurnal terposting sampai tanggal tsb, untuk akun `tracksCashflow`.
 * Dua agregat terpisah — opening balance dari `FinanceBankAccount`, mutasi
 * dari `FinanceJournalLine`. Tidak ada baris mentah yang ditarik.
 */
async function totalCashAndBank(asOf: Date): Promise<Prisma.Decimal> {
  const [openingRows, mutationAgg] = await Promise.all([
    prisma.financeBankAccount.findMany({
      where: { openingAsOf: { lte: asOf } },
      select: { openingBalance: true },
    }),
    prisma.financeJournalLine.aggregate({
      where: {
        entry: {
          status: FinanceJournalStatus.POSTED,
          entryDate: { lte: asOf },
        },
        account: { tracksCashflow: true },
      },
      _sum: { debitBase: true, creditBase: true },
    }),
  ]);

  let total = D0();
  for (const r of openingRows) total = total.plus(r.openingBalance);
  total = total
    .plus(toDecimal(mutationAgg._sum.debitBase))
    .minus(toDecimal(mutationAgg._sum.creditBase));
  return total;
}

/**
 * P&L per brand untuk periode aktif, dilakukan via `groupBy` agar Postgres
 * yang menjumlahkan — tidak men-stream baris ke aplikasi.
 */
async function brandPnlForPeriod(range: { gte: Date; lte: Date }) {
  type GroupedRow = {
    brandId: string | null;
    _sum: { debitBase: Prisma.Decimal | null; creditBase: Prisma.Decimal | null };
  };
  const [revenueGrouped, expenseGrouped] = (await Promise.all([
    prisma.financeJournalLine.groupBy({
      by: ["brandId"],
      where: {
        entry: {
          status: FinanceJournalStatus.POSTED,
          entryDate: range,
        },
        account: { type: FinanceLedgerType.REVENUE },
      },
      _sum: { debitBase: true, creditBase: true },
    }),
    prisma.financeJournalLine.groupBy({
      by: ["brandId"],
      where: {
        entry: {
          status: FinanceJournalStatus.POSTED,
          entryDate: range,
        },
        account: { type: FinanceLedgerType.EXPENSE },
      },
      _sum: { debitBase: true, creditBase: true },
    }),
  ])) as [GroupedRow[], GroupedRow[]];
  return {
    revenueGrouped,
    expenseGrouped,
  };
}

/**
 * Statistik rekonsiliasi per akun bank (total baris vs. yang sudah cocok),
 * dihitung di SQL via `GROUP BY` — tanpa harus menarik setiap
 * `BankStatementLine`.
 */
async function bankReconciliationStats() {
  return prisma.$queryRaw<
    Array<{
      bankAccountId: string;
      totalLines: bigint;
      matchedLines: bigint;
    }>
  >`
    SELECT
      bsi."bankAccountId" AS "bankAccountId",
      COUNT(*)::bigint AS "totalLines",
      COUNT(bsl."matchedJournalLineId")::bigint AS "matchedLines"
    FROM "BankStatementLine" bsl
    JOIN "BankStatementImport" bsi ON bsi."id" = bsl."importId"
    GROUP BY bsi."bankAccountId"
  `;
}

function ageInDays(due: Date, ref: Date): number {
  const ms = ref.getTime() - new Date(due).getTime();
  return Math.floor(ms / 86_400_000);
}

type AgingStatus =
  | { kind: "overdue"; days: number }
  | { kind: "due-soon"; days: number }
  | { kind: "on-track" }
  | { kind: "paid" };

function classifyAging(due: Date, ref: Date): AgingStatus {
  const days = ageInDays(due, ref);
  if (days > 0) return { kind: "overdue", days };
  if (days >= -7) return { kind: "due-soon", days: -days };
  return { kind: "on-track" };
}

export async function loadFinanceDashboard(period: DashboardPeriod) {
  const { start, end, prevStart, prevEnd } = periodBounds(period);
  const today = new Date();
  const asOf = today.getTime() < end.getTime() ? today : end;

  const [
    cashAndBank,
    revenueCurr,
    expenseCurr,
    revenuePrev,
    expensePrev,
    cashCurr,
    cashPrev,
    apBills,
    arInvoices,
    bankAccounts,
    reconciliationStats,
    recentJournals,
    brands,
    brandPnlData,
  ] = await Promise.all([
    totalCashAndBank(asOf),
    ledgerSumByType(FinanceLedgerType.REVENUE, { gte: start, lte: end }),
    ledgerSumByType(FinanceLedgerType.EXPENSE, { gte: start, lte: end }),
    ledgerSumByType(FinanceLedgerType.REVENUE, { gte: prevStart, lte: prevEnd }),
    ledgerSumByType(FinanceLedgerType.EXPENSE, { gte: prevStart, lte: prevEnd }),
    cashFlowSums({ gte: start, lte: end }),
    cashFlowSums({ gte: prevStart, lte: prevEnd }),
    prisma.financeApBill.findMany({
      where: { status: { not: FinanceApArDocStatus.PAID } },
      include: {
        vendor: { select: { name: true } },
        payments: { select: { amount: true } },
      },
      orderBy: [{ dueDate: "asc" }],
    }),
    prisma.financeArInvoice.findMany({
      where: { status: { not: FinanceApArDocStatus.PAID } },
      include: {
        payments: { select: { amount: true } },
      },
      orderBy: [{ dueDate: "asc" }],
    }),
    prisma.financeBankAccount.findMany({
      select: {
        id: true,
        name: true,
        institution: true,
        accountMask: true,
        ledgerAccount: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    bankReconciliationStats(),
    prisma.financeJournalEntry.findMany({
      where: { status: FinanceJournalStatus.POSTED },
      orderBy: [{ entryDate: "desc" }, { postedAt: "desc" }],
      take: 5,
      include: {
        lines: {
          select: { debitBase: true, creditBase: true },
        },
      },
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    brandPnlForPeriod({ gte: start, lte: end }),
  ]);

  const netCurr = revenueCurr.minus(expenseCurr);
  const netPrev = revenuePrev.minus(expensePrev);

  const apOutstanding = apBills.map((b) => {
    const paid = b.payments.reduce((a, p) => a.plus(p.amount), D0());
    const remaining = new Prisma.Decimal(b.amount).minus(paid);
    const status = classifyAging(b.dueDate, today);
    return {
      id: b.id,
      vendorName: b.vendorName ?? b.vendor?.name ?? "—",
      billNumber: b.billNumber ?? null,
      dueDate: b.dueDate,
      remaining,
      status,
    };
  });

  const arOutstanding = arInvoices.map((i) => {
    const paid = i.payments.reduce((a, p) => a.plus(p.amount), D0());
    const remaining = new Prisma.Decimal(i.amount).minus(paid);
    const status = classifyAging(i.dueDate, today);
    return {
      id: i.id,
      customerName: i.customerName,
      invoiceNumber: i.invoiceNumber ?? null,
      dueDate: i.dueDate,
      remaining,
      status,
    };
  });

  const apTotal = apOutstanding.reduce((a, r) => a.plus(r.remaining), D0());
  const arTotal = arOutstanding.reduce((a, r) => a.plus(r.remaining), D0());

  const reconByBank = new Map(
    reconciliationStats.map((r) => [
      r.bankAccountId,
      { total: Number(r.totalLines), matched: Number(r.matchedLines) },
    ]),
  );
  const banks = bankAccounts.map((b) => {
    const s = reconByBank.get(b.id) ?? { total: 0, matched: 0 };
    return {
      id: b.id,
      name: b.name,
      institution: b.institution ?? null,
      mask: b.accountMask ?? null,
      totalLines: s.total,
      matchedLines: s.matched,
      progress: s.total === 0 ? 0 : Math.round((s.matched / s.total) * 100),
    };
  });

  const recent = recentJournals.map((e) => {
    let total = D0();
    for (const l of e.lines) total = total.plus(l.debitBase);
    return {
      id: e.id,
      date: e.entryDate,
      reference: e.reference ?? null,
      memo: e.memo ?? null,
      total,
    };
  });

  type BrandRow = {
    id: string | null;
    name: string;
    revenue: Prisma.Decimal;
    expense: Prisma.Decimal;
  };
  const brandMap = new Map<string | null, BrandRow>();
  brandMap.set(null, { id: null, name: "Tanpa brand", revenue: D0(), expense: D0() });
  for (const b of brands) {
    brandMap.set(b.id, { id: b.id, name: b.name, revenue: D0(), expense: D0() });
  }
  for (const r of brandPnlData.revenueGrouped) {
    const row = brandMap.get(r.brandId) ?? brandMap.get(null)!;
    // REVENUE: signed = credit - debit
    row.revenue = row.revenue
      .plus(toDecimal(r._sum.creditBase))
      .minus(toDecimal(r._sum.debitBase));
  }
  for (const r of brandPnlData.expenseGrouped) {
    const row = brandMap.get(r.brandId) ?? brandMap.get(null)!;
    // EXPENSE: signed = debit - credit
    row.expense = row.expense
      .plus(toDecimal(r._sum.debitBase))
      .minus(toDecimal(r._sum.creditBase));
  }
  const brandPnl = [...brandMap.values()]
    .map((r) => {
      const net = r.revenue.minus(r.expense);
      const rev = Number(r.revenue.toString());
      const margin = rev === 0 ? null : (Number(net.toString()) / rev) * 100;
      return { id: r.id, name: r.name, revenue: r.revenue, net, margin };
    })
    .filter((r) => !r.revenue.isZero() || !r.net.isZero())
    .sort((a, b) => Number(b.revenue.minus(a.revenue).toString()));

  const overdueAr = arOutstanding.filter((r) => r.status.kind === "overdue");
  const overdueAp = apOutstanding.filter((r) => r.status.kind === "overdue");
  const dueSoonCount =
    arOutstanding.filter((r) => r.status.kind === "due-soon").length +
    apOutstanding.filter((r) => r.status.kind === "due-soon").length;
  const dueSoonAp = apOutstanding
    .filter((r) => r.status.kind === "due-soon")
    .reduce((a, r) => a.plus(r.remaining), D0());
  const dueSoonAr = arOutstanding
    .filter((r) => r.status.kind === "due-soon")
    .reduce((a, r) => a.plus(r.remaining), D0());
  const reconPending = banks.filter(
    (b) => b.totalLines > 0 && b.progress < 100,
  );

  return {
    period,
    asOf,
    today,
    kpis: {
      cashAndBank,
      revenue: { current: revenueCurr, previous: revenuePrev, deltaPct: pctChange(revenueCurr, revenuePrev) },
      expense: { current: expenseCurr, previous: expensePrev, deltaPct: pctChange(expenseCurr, expensePrev) },
      net: { current: netCurr, previous: netPrev, deltaPct: pctChange(netCurr, netPrev) },
      cash: {
        current: cashCurr.net,
        previous: cashPrev.net,
        deltaPct: pctChange(cashCurr.net, cashPrev.net),
        inflow: cashCurr.inflow,
        outflow: cashCurr.outflow,
      },
    },
    aging: {
      ap: apOutstanding.slice(0, 6),
      apTotal,
      apOverdueCount: overdueAp.length,
      apOverdueTotal: overdueAp.reduce((a, r) => a.plus(r.remaining), D0()),
      ar: arOutstanding.slice(0, 6),
      arTotal,
      arOverdueCount: overdueAr.length,
      arOverdueTotal: overdueAr.reduce((a, r) => a.plus(r.remaining), D0()),
    },
    banks,
    bankAccountsCount: banks.length,
    recentJournals: recent,
    brandPnl,
    alerts: {
      overdueArCount: overdueAr.length,
      overdueArTotal: overdueAr.reduce((a, r) => a.plus(r.remaining), D0()),
      overdueApCount: overdueAp.length,
      overdueApTotal: overdueAp.reduce((a, r) => a.plus(r.remaining), D0()),
      dueSoonCount,
      dueSoonAp,
      dueSoonAr,
      reconPendingCount: reconPending.length,
      reconPendingNames: reconPending.map((b) => b.name),
    },
  };
}

import "server-only";
import {
  FinanceApArDocStatus,
  FinanceJournalStatus,
  FinanceLedgerType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signedBalanceForAccount, zeroDecimal } from "@/lib/finance-money";

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

async function ledgerSumByType(
  type: FinanceLedgerType,
  range: { gte?: Date; lte: Date },
): Promise<Prisma.Decimal> {
  const lines = await prisma.financeJournalLine.findMany({
    where: {
      entry: {
        status: FinanceJournalStatus.POSTED,
        entryDate: range,
      },
      account: { type },
    },
    select: { debitBase: true, creditBase: true, account: { select: { type: true } } },
  });
  let total = D0();
  for (const l of lines) {
    total = total.plus(
      signedBalanceForAccount(l.account.type, l.debitBase, l.creditBase),
    );
  }
  return total;
}

async function cashFlowSums(range: { gte?: Date; lte: Date }) {
  const lines = await prisma.financeJournalLine.findMany({
    where: {
      entry: {
        status: FinanceJournalStatus.POSTED,
        entryDate: range,
      },
      account: { tracksCashflow: true },
    },
    select: { debitBase: true, creditBase: true },
  });
  let inflow = D0();
  let outflow = D0();
  for (const l of lines) {
    const delta = l.debitBase.minus(l.creditBase);
    if (delta.greaterThan(0)) inflow = inflow.plus(delta);
    else if (delta.lessThan(0)) outflow = outflow.plus(delta.abs());
  }
  return {
    inflow,
    outflow,
    net: inflow.minus(outflow),
  };
}

async function totalCashAndBank(asOf: Date) {
  const [bankAccounts, lines] = await Promise.all([
    prisma.financeBankAccount.findMany({
      select: { openingBalance: true, openingAsOf: true },
    }),
    prisma.financeJournalLine.findMany({
      where: {
        entry: {
          status: FinanceJournalStatus.POSTED,
          entryDate: { lte: asOf },
        },
        account: { tracksCashflow: true },
      },
      select: {
        debitBase: true,
        creditBase: true,
        entry: { select: { entryDate: true } },
      },
    }),
  ]);

  let total = D0();
  for (const bank of bankAccounts) {
    if (bank.openingAsOf.getTime() <= asOf.getTime()) {
      total = total.plus(bank.openingBalance);
    }
  }
  for (const line of lines) {
    total = total.plus(line.debitBase).minus(line.creditBase);
  }
  return total;
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
    recentJournals,
    brands,
    brandRevenueLines,
    brandExpenseLines,
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
      include: {
        ledgerAccount: { select: { id: true, name: true } },
        imports: {
          include: {
            lines: {
              select: { id: true, matchedJournalLineId: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
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
    prisma.financeJournalLine.findMany({
      where: {
        entry: {
          status: FinanceJournalStatus.POSTED,
          entryDate: { gte: start, lte: end },
        },
        account: { type: FinanceLedgerType.REVENUE },
      },
      select: { brandId: true, debitBase: true, creditBase: true },
    }),
    prisma.financeJournalLine.findMany({
      where: {
        entry: {
          status: FinanceJournalStatus.POSTED,
          entryDate: { gte: start, lte: end },
        },
        account: { type: FinanceLedgerType.EXPENSE },
      },
      select: { brandId: true, debitBase: true, creditBase: true },
    }),
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

  const banks = bankAccounts.map((b) => {
    let totalLines = 0;
    let matchedLines = 0;
    for (const imp of b.imports) {
      for (const line of imp.lines) {
        totalLines += 1;
        if (line.matchedJournalLineId) matchedLines += 1;
      }
    }
    return {
      id: b.id,
      name: b.name,
      institution: b.institution ?? null,
      mask: b.accountMask ?? null,
      totalLines,
      matchedLines,
      progress:
        totalLines === 0 ? 0 : Math.round((matchedLines / totalLines) * 100),
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

  type BrandRow = { id: string | null; name: string; revenue: Prisma.Decimal; expense: Prisma.Decimal };
  const brandMap = new Map<string | null, BrandRow>();
  brandMap.set(null, { id: null, name: "Tanpa brand", revenue: D0(), expense: D0() });
  for (const b of brands) {
    brandMap.set(b.id, { id: b.id, name: b.name, revenue: D0(), expense: D0() });
  }
  for (const l of brandRevenueLines) {
    const key = l.brandId;
    const row = brandMap.get(key) ?? brandMap.get(null)!;
    row.revenue = row.revenue.plus(l.creditBase).minus(l.debitBase);
  }
  for (const l of brandExpenseLines) {
    const key = l.brandId;
    const row = brandMap.get(key) ?? brandMap.get(null)!;
    row.expense = row.expense.plus(l.debitBase).minus(l.creditBase);
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

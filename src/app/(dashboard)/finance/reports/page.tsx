import { FileBarChart, Sparkles } from "lucide-react";
import {
  reportBalanceSheetComparison,
  reportCashFlowStatement,
  reportProfitLossComparison,
  reportTaxBuckets,
  reportTrialBalance,
} from "@/actions/finance-reports";
import { prisma } from "@/lib/prisma";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import {
  ReportsClient,
  type SerializedReports,
} from "./reports-client";
import { ReportFilterBar } from "@/components/finance/report-filter-bar";

type SearchParams = {
  from?: string;
  to?: string;
  brandId?: string;
  view?: string;
};

function defaultRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

function parseRange(sp: SearchParams) {
  const def = defaultRange();
  const from = sp.from ? new Date(sp.from) : def.from;
  const to = sp.to ? new Date(sp.to + "T23:59:59") : def.to;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return def;
  return { from, to };
}

export default async function FinanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { from, to } = parseRange(sp);
  const brandId = sp.brandId && sp.brandId !== "__all__" ? sp.brandId : null;
  const initialView = (sp.view ?? "trial-balance") as SerializedReports["initialView"];

  const [brands, trialBalance, profitLoss, balanceSheet, cashFlow, tax] =
    await Promise.all([
      prisma.brand.findMany({ orderBy: { name: "asc" } }),
      reportTrialBalance({ asOf: to, brandId, hideZero: true }),
      reportProfitLossComparison({ from, to, brandId }),
      reportBalanceSheetComparison({ asOf: to, brandId }),
      reportCashFlowStatement({ from, to, brandId }),
      reportTaxBuckets({ from, to, brandId }),
    ]);

  const data: SerializedReports = {
    initialView,
    period: { from: from.toISOString(), to: to.toISOString() },
    brandId: brandId ?? null,
    brands: brands.map((b) => ({ id: b.id, name: b.name })),
    trialBalance: {
      asOf: trialBalance.asOf.toISOString(),
      isBalanced: trialBalance.isBalanced,
      totals: {
        debit: trialBalance.totals.debit.toString(),
        credit: trialBalance.totals.credit.toString(),
      },
      rows: trialBalance.rows.map((r) => ({
        accountId: r.accountId,
        code: r.code,
        name: r.name,
        type: r.type,
        debit: r.debit.toString(),
        credit: r.credit.toString(),
      })),
    },
    profitLoss: {
      period: {
        from: profitLoss.period.from.toISOString(),
        to: profitLoss.period.to.toISOString(),
      },
      previousPeriod: {
        from: profitLoss.previousPeriod.from.toISOString(),
        to: profitLoss.previousPeriod.to.toISOString(),
      },
      revenue: {
        current: profitLoss.revenue.current.toString(),
        previous: profitLoss.revenue.previous.toString(),
      },
      expense: {
        current: profitLoss.expense.current.toString(),
        previous: profitLoss.expense.previous.toString(),
      },
      netIncome: {
        current: profitLoss.netIncome.current.toString(),
        previous: profitLoss.netIncome.previous.toString(),
      },
      rows: profitLoss.rows.map((r) => ({
        code: r.code,
        name: r.name,
        type: r.type,
        current: r.current.toString(),
        previous: r.previous.toString(),
      })),
    },
    balanceSheet: {
      asOf: balanceSheet.asOf.toISOString(),
      previousAsOf: balanceSheet.previousAsOf.toISOString(),
      current: serializeBs(balanceSheet.current),
      previous: serializeBs(balanceSheet.previous),
    },
    cashFlow: {
      from: cashFlow.from.toISOString(),
      to: cashFlow.to.toISOString(),
      totalInflow: cashFlow.totalInflow.toString(),
      totalOutflow: cashFlow.totalOutflow.toString(),
      netCash: cashFlow.netCash.toString(),
      groups: cashFlow.groups.map((g) => ({
        category: g.category,
        label: g.label,
        inflow: g.inflow.toString(),
        outflow: g.outflow.toString(),
        net: g.net.toString(),
        byCounterAccount: g.byCounterAccount.map((c) => ({
          accountId: c.accountId,
          code: c.code,
          name: c.name,
          inflow: c.inflow.toString(),
          outflow: c.outflow.toString(),
          net: c.net.toString(),
        })),
      })),
    },
    tax: tax.rows.map((t) => ({
      code: t.code,
      label: t.label,
      amount: t.amount.toString(),
    })),
  };

  return (
    <FinancePageShell
      maxWidth="2xl"
      icon={<FileBarChart className="size-5" />}
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Laporan" },
      ]}
      title="Pelaporan keuangan"
      description="Neraca saldo, laba rugi, neraca, arus kas, dan rekap pajak — dari jurnal terposting (IDR)."
      actions={
        <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full border border-primary/20 px-2.5 py-1 text-[11px] font-semibold">
          <Sparkles className="size-3" /> Dengan perbandingan periode lalu
        </span>
      }
    >
      <ReportFilterBar
        basePath="/finance/reports"
        fromIso={from.toISOString()}
        toIso={to.toISOString()}
        brandId={brandId}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
      />

      <ReportsClient data={data} />
    </FinancePageShell>
  );
}

function serializeBs(bs: {
  assets: { code: string; name: string; amount: { toString(): string } }[];
  liabilities: { code: string; name: string; amount: { toString(): string } }[];
  equity: { code: string; name: string; amount: { toString(): string } }[];
  retainedEarnings: { toString(): string };
}) {
  return {
    assets: bs.assets.map((r) => ({
      code: r.code,
      name: r.name,
      amount: r.amount.toString(),
    })),
    liabilities: bs.liabilities.map((r) => ({
      code: r.code,
      name: r.name,
      amount: r.amount.toString(),
    })),
    equity: bs.equity.map((r) => ({
      code: r.code,
      name: r.name,
      amount: r.amount.toString(),
    })),
    retainedEarnings: bs.retainedEarnings.toString(),
  };
}

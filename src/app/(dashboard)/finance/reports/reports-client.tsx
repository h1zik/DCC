"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Equal,
} from "lucide-react";
import { FinanceLedgerType } from "@prisma/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Money } from "@/components/finance/money";
import { FinanceSectionCard } from "@/components/finance/section-card";
import { FinanceEmptyState } from "@/components/finance/empty-state";
import {
  FINANCE_TYPE_GROUP_ORDER,
  FINANCE_TYPE_LABEL,
  FINANCE_TYPE_TONE,
  formatDateId,
  formatSignedPercent,
} from "@/lib/finance-format";
import { cn } from "@/lib/utils";

export type SerializedReports = {
  initialView: "trial-balance" | "profit-loss" | "balance-sheet" | "cash-flow" | "tax";
  period: { from: string; to: string };
  brandId: string | null;
  brands: { id: string; name: string }[];
  trialBalance: {
    asOf: string;
    isBalanced: boolean;
    totals: { debit: string; credit: string };
    rows: {
      accountId: string;
      code: string;
      name: string;
      type: FinanceLedgerType;
      debit: string;
      credit: string;
    }[];
  };
  profitLoss: {
    period: { from: string; to: string };
    previousPeriod: { from: string; to: string };
    revenue: { current: string; previous: string };
    expense: { current: string; previous: string };
    netIncome: { current: string; previous: string };
    rows: {
      code: string;
      name: string;
      type: FinanceLedgerType;
      current: string;
      previous: string;
    }[];
  };
  balanceSheet: {
    asOf: string;
    previousAsOf: string;
    current: BsSnapshot;
    previous: BsSnapshot;
  };
  cashFlow: {
    from: string;
    to: string;
    totalInflow: string;
    totalOutflow: string;
    netCash: string;
    groups: {
      category: "operating" | "investing" | "financing";
      label: string;
      inflow: string;
      outflow: string;
      net: string;
      byCounterAccount: {
        accountId: string;
        code: string;
        name: string;
        inflow: string;
        outflow: string;
        net: string;
      }[];
    }[];
  };
  tax: { code: string; label: string; amount: string }[];
};

type BsSnapshot = {
  assets: { code: string; name: string; amount: string }[];
  liabilities: { code: string; name: string; amount: string }[];
  equity: { code: string; name: string; amount: string }[];
  retainedEarnings: string;
};

export function ReportsClient({ data }: { data: SerializedReports }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<SerializedReports["initialView"]>(
    data.initialView,
  );

  // Sync local state when server props change (e.g. when user changes filter
  // bar and the page re-renders with a different initialView).
  useEffect(() => {
    setView(data.initialView);
  }, [data.initialView]);

  function handleChange(v: string) {
    const next = v as SerializedReports["initialView"];
    setView(next);
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    sp.set("view", next);
    router.replace(`/finance/reports?${sp.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={view} onValueChange={handleChange} className="gap-4">
      <TabsList variant="line">
        <TabsTrigger value="trial-balance">Neraca saldo</TabsTrigger>
        <TabsTrigger value="profit-loss">Laba rugi</TabsTrigger>
        <TabsTrigger value="balance-sheet">Neraca</TabsTrigger>
        <TabsTrigger value="cash-flow">Arus kas</TabsTrigger>
        <TabsTrigger value="tax">Pajak</TabsTrigger>
      </TabsList>

      <TabsContent value="trial-balance">
        <TrialBalanceView tb={data.trialBalance} />
      </TabsContent>

      <TabsContent value="profit-loss">
        <ProfitLossView pl={data.profitLoss} />
      </TabsContent>

      <TabsContent value="balance-sheet">
        <BalanceSheetView bs={data.balanceSheet} />
      </TabsContent>

      <TabsContent value="cash-flow">
        <CashFlowView cf={data.cashFlow} />
      </TabsContent>

      <TabsContent value="tax">
        <TaxView rows={data.tax} period={data.period} />
      </TabsContent>
    </Tabs>
  );
}

/* ---------------- Trial Balance ---------------- */

function TrialBalanceView({ tb }: { tb: SerializedReports["trialBalance"] }) {
  const grouped = useMemo(() => {
    const map = new Map<FinanceLedgerType, typeof tb.rows>();
    for (const r of tb.rows) {
      const cur = map.get(r.type) ?? [];
      cur.push(r);
      map.set(r.type, cur);
    }
    return FINANCE_TYPE_GROUP_ORDER.map((t) => ({
      type: t,
      rows: map.get(t) ?? [],
    })).filter((g) => g.rows.length > 0);
  }, [tb.rows]);

  return (
    <FinanceSectionCard
      title="Neraca saldo (Trial Balance)"
      accent={tb.isBalanced ? "emerald" : "rose"}
      description={`Ringkasan saldo akhir per akun, per ${formatDateId(new Date(tb.asOf))}.`}
      right={
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            tb.isBalanced
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-500/15 text-rose-700 dark:text-rose-300",
          )}
        >
          {tb.isBalanced ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <AlertTriangle className="size-3.5" />
          )}
          {tb.isBalanced ? "Buku seimbang" : "Tidak seimbang!"}
        </span>
      }
    >
      {tb.rows.length === 0 ? (
        <FinanceEmptyState
          icon={<Equal className="size-5" />}
          title="Tidak ada saldo terposting"
          description="Belum ada jurnal yang diposting untuk periode/filter ini."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader sticky>
              <TableRow>
                <TableHead className="w-20">Kode</TableHead>
                <TableHead>Nama akun</TableHead>
                <TableHead className="w-32">Tipe</TableHead>
                <TableHead className="w-40 text-right">Debit</TableHead>
                <TableHead className="w-40 text-right">Kredit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map((g) => {
                const sumD = g.rows.reduce((a, r) => a + Number(r.debit), 0);
                const sumC = g.rows.reduce((a, r) => a + Number(r.credit), 0);
                const tone = FINANCE_TYPE_TONE[g.type];
                return (
                  <FragmentRows key={g.type}>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={3}>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                          <span className={cn("size-2 rounded-full", tone.dot)} />
                          {FINANCE_TYPE_LABEL[g.type]}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold">
                        <Money value={sumD} zeroAsDash />
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold">
                        <Money value={sumC} zeroAsDash />
                      </TableCell>
                    </TableRow>
                    {g.rows.map((r) => (
                      <TableRow key={r.accountId}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {r.code}
                        </TableCell>
                        <TableCell className="text-sm">{r.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {FINANCE_TYPE_LABEL[r.type]}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <Money value={r.debit} zeroAsDash />
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <Money value={r.credit} zeroAsDash />
                        </TableCell>
                      </TableRow>
                    ))}
                  </FragmentRows>
                );
              })}
              <TableRow className="border-t-2 border-foreground/30 bg-muted/40">
                <TableCell colSpan={3}>
                  <span className="text-sm font-semibold uppercase tracking-wide">
                    Total
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm font-bold">
                  <Money value={tb.totals.debit} />
                </TableCell>
                <TableCell className="text-right text-sm font-bold">
                  <Money value={tb.totals.credit} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </FinanceSectionCard>
  );
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/* ---------------- Profit & Loss ---------------- */

function ProfitLossView({ pl }: { pl: SerializedReports["profitLoss"] }) {
  const revenueRows = pl.rows.filter((r) => r.type === FinanceLedgerType.REVENUE);
  const expenseRows = pl.rows.filter((r) => r.type === FinanceLedgerType.EXPENSE);

  const revDelta = pctDelta(pl.revenue.current, pl.revenue.previous);
  const expDelta = pctDelta(pl.expense.current, pl.expense.previous);
  const netDelta = pctDelta(pl.netIncome.current, pl.netIncome.previous);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile
          label="Pendapatan"
          accent="emerald"
          current={pl.revenue.current}
          previous={pl.revenue.previous}
          deltaPct={revDelta}
        />
        <KpiTile
          label="Beban"
          accent="amber"
          current={pl.expense.current}
          previous={pl.expense.previous}
          deltaPct={expDelta}
          deltaInverse
        />
        <KpiTile
          label="Laba bersih"
          accent={
            Number(pl.netIncome.current) >= 0 ? "violet" : "rose"
          }
          current={pl.netIncome.current}
          previous={pl.netIncome.previous}
          deltaPct={netDelta}
        />
      </div>

      <FinanceSectionCard
        title="Laba rugi"
        accent="emerald"
        description={`${formatDateId(new Date(pl.period.from))} – ${formatDateId(new Date(pl.period.to))} · dibandingkan periode lalu`}
      >
        <PlGroup
          title="Pendapatan"
          rows={revenueRows}
          color="emerald"
          totalCurrent={pl.revenue.current}
          totalPrevious={pl.revenue.previous}
        />
        <PlGroup
          title="Beban"
          rows={expenseRows}
          color="amber"
          totalCurrent={pl.expense.current}
          totalPrevious={pl.expense.previous}
        />
        <NetIncomeRow
          current={pl.netIncome.current}
          previous={pl.netIncome.previous}
        />
      </FinanceSectionCard>
    </div>
  );
}

function PlGroup({
  title,
  rows,
  color,
  totalCurrent,
  totalPrevious,
}: {
  title: string;
  rows: SerializedReports["profitLoss"]["rows"];
  color: "emerald" | "amber";
  totalCurrent: string;
  totalPrevious: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead colSpan={2}>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    color === "emerald" ? "bg-emerald-500" : "bg-amber-500",
                  )}
                />
                {title}
              </span>
            </TableHead>
            <TableHead className="w-40 text-right text-xs">Periode ini</TableHead>
            <TableHead className="w-40 text-right text-xs">Periode lalu</TableHead>
            <TableHead className="w-20 text-right text-xs">Δ%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground py-4 text-center text-xs">
                Tidak ada mutasi.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const d = pctDelta(r.current, r.previous);
              return (
                <TableRow key={r.code}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.code}
                  </TableCell>
                  <TableCell className="text-sm">{r.name}</TableCell>
                  <TableCell className="text-right text-sm">
                    <Money value={r.current} zeroAsDash />
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    <Money value={r.previous} zeroAsDash />
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <DeltaChip pct={d} />
                  </TableCell>
                </TableRow>
              );
            })
          )}
          <TableRow className="bg-muted/30 border-t">
            <TableCell colSpan={2} className="text-xs font-semibold">
              Subtotal {title.toLowerCase()}
            </TableCell>
            <TableCell className="text-right text-sm font-semibold">
              <Money value={totalCurrent} />
            </TableCell>
            <TableCell className="text-right text-xs">
              <Money value={totalPrevious} />
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function NetIncomeRow({ current, previous }: { current: string; previous: string }) {
  const c = Number(current);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 px-4 py-3",
        c >= 0
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-rose-500/30 bg-rose-500/5",
      )}
    >
      <span className="text-sm font-semibold uppercase tracking-wide">
        Laba bersih (current period)
      </span>
      <div className="flex items-center gap-4 text-right">
        <span className="text-muted-foreground text-xs">
          Sebelumnya: <Money value={previous} />
        </span>
        <span className="text-lg font-bold">
          <Money value={current} tone="auto" />
        </span>
      </div>
    </div>
  );
}

/* ---------------- Balance Sheet ---------------- */

function BalanceSheetView({ bs }: { bs: SerializedReports["balanceSheet"] }) {
  const totalAssets = sum(bs.current.assets.map((r) => r.amount));
  const totalLiab = sum(bs.current.liabilities.map((r) => r.amount));
  const totalEq = sum(bs.current.equity.map((r) => r.amount)) + Number(bs.current.retainedEarnings);
  const totalLE = totalLiab + totalEq;
  const isBalanced = Math.abs(totalAssets - totalLE) < 0.5;

  const totalAssetsPrev = sum(bs.previous.assets.map((r) => r.amount));
  const totalLiabPrev = sum(bs.previous.liabilities.map((r) => r.amount));
  const totalEqPrev =
    sum(bs.previous.equity.map((r) => r.amount)) + Number(bs.previous.retainedEarnings);

  return (
    <FinanceSectionCard
      title="Neraca (Statement of Financial Position)"
      accent="sky"
      description={`Posisi per ${formatDateId(new Date(bs.asOf))} · pembanding ${formatDateId(new Date(bs.previousAsOf))}`}
      right={
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            isBalanced
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-500/15 text-rose-700 dark:text-rose-300",
          )}
        >
          {isBalanced ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <AlertTriangle className="size-3.5" />
          )}
          {isBalanced
            ? "Aktiva = Kewajiban + Ekuitas"
            : "Tidak seimbang"}
        </span>
      }
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <BsSide
          title="Aktiva"
          color="sky"
          rows={bs.current.assets.map((r) => ({
            ...r,
            previous:
              bs.previous.assets.find((p) => p.code === r.code)?.amount ?? "0",
          }))}
          total={totalAssets}
          totalPrev={totalAssetsPrev}
        />
        <div className="flex flex-col gap-3">
          <BsSide
            title="Kewajiban"
            color="rose"
            rows={bs.current.liabilities.map((r) => ({
              ...r,
              previous:
                bs.previous.liabilities.find((p) => p.code === r.code)
                  ?.amount ?? "0",
            }))}
            total={totalLiab}
            totalPrev={totalLiabPrev}
          />
          <BsSide
            title="Ekuitas"
            color="violet"
            rows={[
              ...bs.current.equity.map((r) => ({
                ...r,
                previous:
                  bs.previous.equity.find((p) => p.code === r.code)?.amount ??
                  "0",
              })),
              {
                code: "—",
                name: "Laba ditahan (kumulatif)",
                amount: bs.current.retainedEarnings,
                previous: bs.previous.retainedEarnings,
              },
            ]}
            total={totalEq}
            totalPrev={totalEqPrev}
          />
        </div>
      </div>
    </FinanceSectionCard>
  );
}

function BsSide({
  title,
  color,
  rows,
  total,
  totalPrev,
}: {
  title: string;
  color: "sky" | "rose" | "violet";
  rows: { code: string; name: string; amount: string; previous: string }[];
  total: number;
  totalPrev: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead colSpan={2}>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    color === "sky"
                      ? "bg-sky-500"
                      : color === "rose"
                        ? "bg-rose-500"
                        : "bg-violet-500",
                  )}
                />
                {title}
              </span>
            </TableHead>
            <TableHead className="w-32 text-right text-xs">Saat ini</TableHead>
            <TableHead className="w-32 text-right text-xs">Sebelumnya</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-4 text-center text-xs text-muted-foreground">
                Tidak ada akun.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={`${r.code}-${r.name}`}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.code}
                </TableCell>
                <TableCell className="text-sm">{r.name}</TableCell>
                <TableCell className="text-right text-sm">
                  <Money value={r.amount} zeroAsDash />
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  <Money value={r.previous} zeroAsDash />
                </TableCell>
              </TableRow>
            ))
          )}
          <TableRow className="bg-muted/30 border-t">
            <TableCell colSpan={2} className="text-xs font-semibold">
              Total {title.toLowerCase()}
            </TableCell>
            <TableCell className="text-right text-sm font-bold">
              <Money value={total} />
            </TableCell>
            <TableCell className="text-right text-xs text-muted-foreground">
              <Money value={totalPrev} />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

/* ---------------- Cash Flow ---------------- */

function CashFlowView({ cf }: { cf: SerializedReports["cashFlow"] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile
          label="Total kas masuk"
          accent="emerald"
          current={cf.totalInflow}
          previous={null}
          icon={<ArrowDownCircle className="size-4" />}
        />
        <KpiTile
          label="Total kas keluar"
          accent="rose"
          current={cf.totalOutflow}
          previous={null}
          icon={<ArrowUpCircle className="size-4" />}
        />
        <KpiTile
          label="Net kas periode"
          accent={Number(cf.netCash) >= 0 ? "violet" : "amber"}
          current={cf.netCash}
          previous={null}
        />
      </div>

      {cf.groups.map((g) => (
        <FinanceSectionCard
          key={g.category}
          title={g.label}
          accent={
            g.category === "operating"
              ? "emerald"
              : g.category === "investing"
                ? "sky"
                : "violet"
          }
          right={
            <span className="text-xs">
              Net{" "}
              <span className="ml-1 font-semibold">
                <Money value={g.net} tone="auto" />
              </span>
            </span>
          }
        >
          {g.byCounterAccount.length === 0 ? (
            <p className="text-muted-foreground rounded-md border border-dashed py-3 text-center text-xs">
              Tidak ada transaksi pada kategori ini.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Kode</TableHead>
                    <TableHead>Akun lawan</TableHead>
                    <TableHead className="w-32 text-right">Masuk</TableHead>
                    <TableHead className="w-32 text-right">Keluar</TableHead>
                    <TableHead className="w-32 text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.byCounterAccount.map((c) => (
                    <TableRow key={c.accountId}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.code}
                      </TableCell>
                      <TableCell className="text-sm">{c.name}</TableCell>
                      <TableCell className="text-right text-sm">
                        <Money value={c.inflow} zeroAsDash tone="positive" />
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <Money value={c.outflow} zeroAsDash tone="negative" />
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        <Money value={c.net} tone="auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </FinanceSectionCard>
      ))}
    </div>
  );
}

/* ---------------- Tax ---------------- */

function TaxView({
  rows,
  period,
}: {
  rows: SerializedReports["tax"];
  period: { from: string; to: string };
}) {
  return (
    <FinanceSectionCard
      title="Rekapitulasi pajak"
      accent="amber"
      description={`Mutasi akun PPN/PPh untuk periode ${formatDateId(new Date(period.from))} – ${formatDateId(new Date(period.to))}.`}
    >
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Kode</TableHead>
              <TableHead>Akun pajak</TableHead>
              <TableHead className="text-right">Mutasi periode</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.code}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {t.code}
                </TableCell>
                <TableCell className="text-sm">{t.label}</TableCell>
                <TableCell className="text-right text-sm font-semibold">
                  <Money value={t.amount} tone="auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </FinanceSectionCard>
  );
}

/* ---------------- Shared sub-components ---------------- */

function KpiTile({
  label,
  current,
  previous,
  deltaPct,
  accent = "neutral",
  icon,
  deltaInverse = false,
}: {
  label: string;
  current: string;
  previous: string | null;
  deltaPct?: number | null;
  accent?: "emerald" | "amber" | "violet" | "rose" | "sky" | "neutral";
  icon?: React.ReactNode;
  deltaInverse?: boolean;
}) {
  const ringClass: Record<typeof accent, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    violet: "border-violet-500/30 bg-violet-500/5",
    rose: "border-rose-500/30 bg-rose-500/5",
    sky: "border-sky-500/30 bg-sky-500/5",
    neutral: "border-border bg-card",
  };
  return (
    <div className={cn("relative flex flex-col gap-1.5 rounded-xl border p-3 shadow-sm", ringClass[accent])}>
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {icon ?? null}
          {label}
        </span>
        {deltaPct != null ? <DeltaChip pct={deltaPct} inverse={deltaInverse} /> : null}
      </div>
      <p className="text-foreground text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
        <Money value={current} tone={accent === "rose" ? "negative" : "neutral"} />
      </p>
      {previous != null ? (
        <p className="text-muted-foreground text-[11px]">
          Sebelumnya: <Money value={previous} />
        </p>
      ) : null}
    </div>
  );
}

function DeltaChip({ pct, inverse = false }: { pct: number | null; inverse?: boolean }) {
  if (pct == null)
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
        —
      </span>
    );
  const positive = pct > 0;
  const isGood = inverse ? !positive : positive;
  if (pct === 0)
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
        0%
      </span>
    );
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        isGood
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-rose-500/15 text-rose-700 dark:text-rose-300",
      )}
    >
      {formatSignedPercent(pct)}
    </span>
  );
}

function pctDelta(curr: string, prev: string): number | null {
  const c = Number(curr);
  const p = Number(prev);
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null;
  if (p === 0) {
    if (c === 0) return 0;
    return null;
  }
  return ((c - p) / Math.abs(p)) * 100;
}

function sum(arr: string[]): number {
  return arr.reduce((a, b) => a + Number(b || 0), 0);
}

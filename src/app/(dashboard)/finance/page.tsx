import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Lock,
  Minus,
  Plus,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FinanceClearDemoButton } from "@/components/finance/finance-clear-demo-button";
import { isFinanceDemoResetAllowed } from "@/lib/finance-demo-policy";
import { formatIdr } from "@/lib/finance-money";
import { cn } from "@/lib/utils";
import { loadFinanceDashboard } from "@/lib/finance-dashboard";
import { FINANCE_MONTH_LABELS, periodLabel } from "@/lib/finance-period";
import { PeriodSelector } from "./period-selector";
import { PeriodLockPanel } from "./period-lock-panel";
import { listFinancePeriodLocks } from "@/actions/finance-period-lock";
import { prisma } from "@/lib/prisma";
import { MonthlyReportButton } from "@/components/finance/monthly-report-button";
import {
  defaultReportMonth,
  jakartaToday,
} from "@/lib/finance-monthly-report/period";

// Penyusunan PDF laporan bulanan (server action) butuh waktu lebih dari default.
export const maxDuration = 120;

type SearchParams = { period?: string | string[] };

type Props = {
  searchParams: Promise<SearchParams>;
};

type AgingStatus =
  | { kind: "overdue"; days: number }
  | { kind: "due-soon"; days: number }
  | { kind: "on-track" }
  | { kind: "paid" };

function parsePeriod(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const m = value?.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) {
    const today = jakartaToday();
    return { year: today.year, month: today.month };
  }
  const year = Number(m[1]);
  const month = Math.min(12, Math.max(1, Number(m[2])));
  return { year, month };
}

function formatDateLong(d: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatDateShort(d: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(d);
}

function pctText(p: number | null): string {
  if (p == null) return "—";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(Math.abs(p) >= 100 ? 0 : 1)}%`;
}

function num(d: Prisma.Decimal): number {
  return Number(d.toString());
}

export default async function FinanceDashboardPage({ searchParams }: Props) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const [data, periodLocks, reportBrands] = await Promise.all([
    loadFinanceDashboard(period),
    listFinancePeriodLocks(8),
    prisma.brand.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const isCurrentPeriodLocked = periodLocks.some(
    (l) => l.year === period.year && l.month === period.month,
  );

  const monthName = FINANCE_MONTH_LABELS[period.month - 1];
  const prevMonthName = FINANCE_MONTH_LABELS[(period.month + 10) % 12];

  const revenue = num(data.kpis.revenue.current);
  const expense = num(data.kpis.expense.current);
  const net = num(data.kpis.net.current);
  const margin = revenue > 0 ? (net / revenue) * 100 : null;

  const overdueCount = data.alerts.overdueArCount + data.alerts.overdueApCount;
  const hasActions = overdueCount > 0 || data.alerts.dueSoonCount > 0;

  return (
    <div className="flex w-full flex-col gap-5 pb-6">
      {/* Header */}
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Financial Overview
          </h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span>{formatDateLong(data.today)}</span>
            {isCurrentPeriodLocked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                <Lock className="size-3" aria-hidden />
                {periodLabel(period.year, period.month)} sudah dikunci
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelector year={period.year} month={period.month} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/finance/reports" />}
          >
            <ScrollText className="size-3.5" aria-hidden />
            Laporan
          </Button>
          <MonthlyReportButton
            variant="outline"
            brands={reportBrands}
            currentMonth={jakartaToday()}
            defaultMonth={defaultReportMonth(period)}
          />
          <Button
            type="button"
            size="sm"
            nativeButton={false}
            render={<Link href="/finance/journals" />}
          >
            <Plus className="size-3.5" aria-hidden />
            Jurnal baru
          </Button>
          {isFinanceDemoResetAllowed() ? <FinanceClearDemoButton /> : null}
        </div>
      </header>

      {/* Hero: laba rugi sebagai persamaan + posisi kas */}
      <section
        aria-label="Laba rugi dan posisi kas"
        className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      >
        <div className="border-border bg-card flex flex-col gap-5 rounded-2xl border p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-foreground text-base font-semibold">
              Laba rugi {monthName}
            </h2>
            <p className="text-muted-foreground text-xs">
              Dibanding {prevMonthName}
            </p>
          </div>

          <dl className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start md:gap-3">
            <EquationTerm
              label="Pendapatan"
              value={formatIdr(data.kpis.revenue.current)}
              delta={data.kpis.revenue.deltaPct}
              previous={formatIdr(data.kpis.revenue.previous)}
            />
            <Operator>
              <Minus className="size-4" />
            </Operator>
            <EquationTerm
              label="Beban"
              value={formatIdr(data.kpis.expense.current)}
              delta={data.kpis.expense.deltaPct}
              deltaInverse
              previous={formatIdr(data.kpis.expense.previous)}
            />
            <Operator>
              <span className="text-lg leading-none font-medium">=</span>
            </Operator>
            <EquationTerm
              label={net < 0 ? "Rugi bersih" : "Laba bersih"}
              value={formatIdr(data.kpis.net.current)}
              delta={data.kpis.net.deltaPct}
              previous={formatIdr(data.kpis.net.previous)}
              emphasis={net < 0 ? "loss" : "profit"}
            />
          </dl>

          <MarginBar revenue={revenue} expense={expense} margin={margin} />
        </div>

        <div className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-5 shadow-sm sm:p-6">
          <div className="space-y-1">
            <h2 className="text-foreground text-base font-semibold">
              Kas & bank
            </h2>
            <p className="text-foreground text-3xl font-semibold tracking-tight tabular-nums break-words">
              {formatIdr(data.kpis.cashAndBank)}
            </p>
            <p className="text-muted-foreground text-xs">
              Saldo per {formatDateShort(data.asOf)}
            </p>
          </div>

          <CashFlowSplit
            inflow={data.kpis.cash.inflow}
            outflow={data.kpis.cash.outflow}
            net={data.kpis.cash.current}
            monthName={monthName}
          />

          <div className="border-border/60 mt-auto border-t pt-3">
            {data.banks.length === 0 ? (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Belum ada rekening.{" "}
                <Link
                  href="/finance/chart-of-accounts"
                  className="text-primary font-medium hover:underline"
                >
                  Tandai akun kas di Chart of Accounts
                </Link>
              </p>
            ) : (
              <Link
                href="/finance/chart-of-accounts"
                className="group flex flex-wrap gap-1.5"
                aria-label={`${data.banks.length} rekening, kelola di Chart of Accounts`}
              >
                {data.banks.map((bank) => (
                  <span
                    key={bank.id}
                    className="bg-muted text-foreground group-hover:bg-muted/70 rounded-md px-2 py-1 text-xs font-medium transition-colors"
                  >
                    {bank.name}
                    {bank.mask ? (
                      <span className="text-muted-foreground tabular-nums">
                        {" "}
                        ··{bank.mask}
                      </span>
                    ) : null}
                  </span>
                ))}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Perlu tindakan */}
      <section aria-label="Perlu tindakan">
        {hasActions ? (
          <div className="border-border bg-card flex flex-col divide-y rounded-2xl border shadow-sm sm:flex-row sm:divide-x sm:divide-y-0">
            {overdueCount > 0 ? (
              <ActionItem
                href="/finance/ap-ar"
                tone="danger"
                icon={<AlertTriangle className="size-4" />}
                title={`${overdueCount} tagihan lewat jatuh tempo`}
                detail={`Hutang ${formatIdr(data.alerts.overdueApTotal)}, piutang ${formatIdr(data.alerts.overdueArTotal)}`}
              />
            ) : null}
            {data.alerts.dueSoonCount > 0 ? (
              <ActionItem
                href="/finance/ap-ar"
                tone="warning"
                icon={<Clock className="size-4" />}
                title={`${data.alerts.dueSoonCount} jatuh tempo dalam 7 hari`}
                detail={`Hutang ${formatIdr(data.alerts.dueSoonAp)}, piutang ${formatIdr(data.alerts.dueSoonAr)}`}
              />
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground px-1 text-sm">
            Tidak ada tagihan yang lewat atau mendekati jatuh tempo.
          </p>
        )}
      </section>

      {/* Hutang & piutang */}
      <section
        aria-label="Hutang dan piutang"
        className="grid gap-3 lg:grid-cols-2"
      >
        <AgingPanel
          title="Hutang (AP)"
          partyLabel="Vendor"
          total={data.aging.apTotal}
          overdueTotal={data.aging.apOverdueTotal}
          overdueCount={data.aging.apOverdueCount}
          rows={data.aging.ap.map((r) => ({
            id: r.id,
            party: r.vendorName,
            doc: r.billNumber,
            remaining: r.remaining,
            status: r.status,
          }))}
          emptyMessage="Tidak ada hutang yang belum dibayar."
        />
        <AgingPanel
          title="Piutang (AR)"
          partyLabel="Customer"
          total={data.aging.arTotal}
          overdueTotal={data.aging.arOverdueTotal}
          overdueCount={data.aging.arOverdueCount}
          rows={data.aging.ar.map((r) => ({
            id: r.id,
            party: r.customerName,
            doc: r.invoiceNumber,
            remaining: r.remaining,
            status: r.status,
          }))}
          emptyMessage="Tidak ada piutang yang belum tertagih."
        />
      </section>

      {/* Brand & jurnal */}
      <section
        aria-label="P&L per brand dan jurnal terakhir"
        className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
      >
        <Panel
          title={`P&L per brand, ${monthName}`}
          action={{ href: "/finance/brands-costing", label: "Brand & Costing" }}
        >
          <BrandPnl rows={data.brandPnl.slice(0, 6)} />
        </Panel>

        <Panel
          title="Jurnal terakhir"
          action={{ href: "/finance/journals", label: "Semua jurnal" }}
        >
          {data.recentJournals.length === 0 ? (
            <EmptyState>
              Belum ada jurnal yang diposting.{" "}
              <Link
                href="/finance/journals"
                className="text-primary font-medium hover:underline"
              >
                Buat jurnal
              </Link>
            </EmptyState>
          ) : (
            <ul className="-my-1 flex flex-col">
              {data.recentJournals.map((row) => (
                <li
                  key={row.id}
                  className="border-border/60 border-b last:border-0"
                >
                  <Link
                    href={`/finance/journals/${row.id}`}
                    className="hover:bg-muted/50 -mx-2 grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-baseline gap-3 rounded-md px-2 py-2.5 transition-colors"
                  >
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatDateShort(row.date)}
                    </span>
                    <span className="text-foreground truncate text-sm">
                      {row.memo?.trim() ||
                        row.reference?.trim() ||
                        "Tanpa keterangan"}
                    </span>
                    <span className="text-foreground text-sm font-medium tabular-nums">
                      {formatIdr(row.total)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {/* Period locks (close the books) */}
      <PeriodLockPanel
        currentPeriod={period}
        locks={periodLocks.map((l) => ({
          id: l.id,
          year: l.year,
          month: l.month,
          lockedAtIso: l.lockedAt.toISOString(),
          lockedByName: l.lockedBy?.name ?? l.lockedBy?.email ?? null,
          reason: l.reason,
        }))}
      />
    </div>
  );
}

/* ---------- Sub-components ---------- */

function DeltaBadge({
  delta,
  inverse = false,
}: {
  delta: number | null;
  /** Untuk beban: kenaikan = jelek (merah), penurunan = bagus (hijau). */
  inverse?: boolean;
}) {
  if (delta == null) {
    return <span className="text-muted-foreground text-xs">Tanpa pembanding</span>;
  }
  const good = delta === 0 ? null : inverse ? delta < 0 : delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        good == null
          ? "text-muted-foreground"
          : good
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-rose-700 dark:text-rose-400",
      )}
    >
      {delta > 0 ? (
        <ArrowUpRight className="size-3.5" aria-hidden />
      ) : delta < 0 ? (
        <ArrowDownRight className="size-3.5" aria-hidden />
      ) : null}
      {pctText(delta)}
    </span>
  );
}

function EquationTerm({
  label,
  value,
  delta,
  previous,
  deltaInverse = false,
  emphasis,
}: {
  label: string;
  value: string;
  delta: number | null;
  previous: string;
  deltaInverse?: boolean;
  emphasis?: "profit" | "loss";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5",
        emphasis && "bg-muted/50 -m-2 rounded-xl p-2 md:-my-3 md:px-3 md:py-3",
      )}
    >
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd
        className={cn(
          "text-2xl font-semibold tracking-tight tabular-nums break-words 2xl:text-[1.75rem]",
          emphasis === "loss"
            ? "text-rose-700 dark:text-rose-400"
            : "text-foreground",
        )}
      >
        {value}
      </dd>
      <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <DeltaBadge delta={delta} inverse={deltaInverse} />
        <span className="text-muted-foreground text-xs tabular-nums">
          dari {previous}
        </span>
      </dd>
    </div>
  );
}

function Operator({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="text-muted-foreground hidden size-7 items-center justify-center self-center rounded-full border md:flex"
    >
      {children}
    </span>
  );
}

/**
 * Satu bar pendapatan: porsi yang habis untuk beban vs yang tersisa sebagai laba.
 * Saat beban melebihi pendapatan, bar penuh jadi beban dan kelebihannya disebut.
 */
function MarginBar({
  revenue,
  expense,
  margin,
}: {
  revenue: number;
  expense: number;
  margin: number | null;
}) {
  if (revenue <= 0 || margin == null) {
    return (
      <p className="text-muted-foreground text-xs">
        Margin belum bisa dihitung karena belum ada pendapatan di periode ini.
      </p>
    );
  }
  const expensePct = Math.min(100, Math.max(0, (expense / revenue) * 100));
  const profitPct = 100 - expensePct;
  const overspend = expense > revenue;
  return (
    <div className="space-y-2">
      <div
        role="img"
        aria-label={`Beban ${expensePct.toFixed(0)}% dari pendapatan, margin ${margin.toFixed(1)}%`}
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full"
      >
        {expensePct > 0 ? (
          <div
            className={cn(
              "h-full rounded-full",
              overspend ? "bg-rose-500" : "bg-foreground/25",
            )}
            style={{ width: `${expensePct}%` }}
            title={`Beban ${((expense / revenue) * 100).toFixed(1)}% dari pendapatan`}
          />
        ) : null}
        {profitPct > 0 ? (
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${profitPct}%` }}
            title={`Laba ${profitPct.toFixed(1)}% dari pendapatan`}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <span
            className={cn(
              "size-2 rounded-full",
              overspend ? "bg-rose-500" : "bg-foreground/25",
            )}
            aria-hidden
          />
          Beban memakai {((expense / revenue) * 100).toFixed(0)}% pendapatan
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-medium",
            overspend ? "text-rose-700 dark:text-rose-400" : "text-foreground",
          )}
        >
          {overspend ? null : (
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
          )}
          {overspend
            ? `Beban melebihi pendapatan, margin ${margin.toFixed(1)}%`
            : `Margin ${margin.toFixed(1)}%`}
        </span>
      </div>
    </div>
  );
}

function CashFlowSplit({
  inflow,
  outflow,
  net,
  monthName,
}: {
  inflow: Prisma.Decimal;
  outflow: Prisma.Decimal;
  net: Prisma.Decimal;
  monthName: string;
}) {
  const i = num(inflow);
  const o = num(outflow);
  const max = Math.max(i, o, 1);
  const rows = [
    { label: "Masuk", value: inflow, width: (i / max) * 100, bar: "bg-emerald-500" },
    { label: "Keluar", value: outflow, width: (o / max) * 100, bar: "bg-rose-500" },
  ];
  const n = num(net);
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Arus kas {monthName}</span>
        <span
          className={cn(
            "font-medium tabular-nums",
            n < 0 ? "text-rose-700 dark:text-rose-400" : "text-foreground",
          )}
        >
          {n > 0 ? "+" : ""}
          {formatIdr(net)}
        </span>
      </div>
      {rows.map((r) => (
        <div
          key={r.label}
          className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2"
        >
          <span className="text-muted-foreground text-xs">{r.label}</span>
          <div className="flex min-w-0 items-center gap-2">
            <div className="bg-muted h-1.5 min-w-0 flex-1 overflow-hidden rounded-full">
              <div
                className={cn("h-full rounded-full", r.bar)}
                style={{ width: `${r.width}%` }}
              />
            </div>
            <span className="text-foreground shrink-0 text-xs tabular-nums">
              {formatIdr(r.value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionItem({
  href,
  tone,
  icon,
  title,
  detail,
}: {
  href: string;
  tone: "danger" | "warning";
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="hover:bg-muted/40 flex flex-1 items-start gap-3 p-4 transition-colors first:rounded-t-2xl last:rounded-b-2xl sm:first:rounded-l-2xl sm:first:rounded-tr-none sm:last:rounded-r-2xl sm:last:rounded-bl-none"
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
          tone === "danger"
            ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
            : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 space-y-0.5">
        <span className="text-foreground block text-sm font-semibold">
          {title}
        </span>
        <span className="text-muted-foreground block text-xs tabular-nums break-words">
          {detail}
        </span>
      </span>
    </Link>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-foreground text-base font-semibold">{title}</h2>
        {action ? (
          <Link
            href={action.href}
            className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-medium underline-offset-4 hover:underline"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground bg-muted/40 rounded-lg px-4 py-6 text-center text-sm">
      {children}
    </p>
  );
}

function AgingPanel({
  title,
  partyLabel,
  total,
  overdueTotal,
  overdueCount,
  rows,
  emptyMessage,
}: {
  title: string;
  partyLabel: string;
  total: Prisma.Decimal;
  overdueTotal: Prisma.Decimal;
  overdueCount: number;
  rows: Array<{
    id: string;
    party: string;
    doc: string | null;
    remaining: Prisma.Decimal;
    status: AgingStatus;
  }>;
  emptyMessage: string;
}) {
  const t = num(total);
  const overduePct = t > 0 ? Math.min(100, (num(overdueTotal) / t) * 100) : 0;
  return (
    <Panel title={title} action={{ href: "/finance/ap-ar", label: "Buka AP & AR" }}>
      {rows.length === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-foreground text-xl font-semibold tracking-tight tabular-nums">
                {formatIdr(total)}
              </p>
              <p
                className={cn(
                  "text-xs tabular-nums",
                  overdueCount > 0
                    ? "font-medium text-rose-700 dark:text-rose-400"
                    : "text-muted-foreground",
                )}
              >
                {overdueCount > 0
                  ? `${formatIdr(overdueTotal)} lewat jatuh tempo`
                  : "Belum ada yang lewat jatuh tempo"}
              </p>
            </div>
            {overdueCount > 0 ? (
              <div
                role="img"
                aria-label={`${overduePct.toFixed(0)}% dari total sudah lewat jatuh tempo`}
                className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
              >
                <div
                  className="h-full rounded-full bg-rose-500"
                  style={{ width: `${overduePct}%` }}
                />
              </div>
            ) : null}
          </div>
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">
              {title}, diurutkan dari jatuh tempo terdekat
            </caption>
            <thead>
              <tr className="text-muted-foreground border-border/60 border-b text-left text-xs">
                <th scope="col" className="pb-2 font-medium">
                  {partyLabel}
                </th>
                <th scope="col" className="w-[36%] pb-2 text-right font-medium">
                  Sisa
                </th>
                <th scope="col" className="w-[30%] pb-2 pl-3 text-right font-medium">
                  Jatuh tempo
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-border/60 border-b last:border-0">
                  <td className="py-2.5 pr-2">
                    <span className="text-foreground block truncate font-medium">
                      {row.party}
                    </span>
                    {row.doc ? (
                      <span className="text-muted-foreground block truncate text-xs">
                        {row.doc}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-foreground py-2.5 text-right tabular-nums">
                    {formatIdr(row.remaining)}
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    <DueLabel status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Panel>
  );
}

function DueLabel({ status }: { status: AgingStatus }) {
  switch (status.kind) {
    case "overdue":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 dark:text-rose-400">
          <AlertTriangle className="size-3" aria-hidden />
          {status.days} hari lewat
        </span>
      );
    case "due-soon":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
          <Clock className="size-3" aria-hidden />
          {status.days <= 0 ? "Hari ini" : `${status.days} hari lagi`}
        </span>
      );
    case "on-track":
      return <span className="text-muted-foreground text-xs">Lebih dari 7 hari</span>;
    case "paid":
      return <span className="text-muted-foreground text-xs">Lunas</span>;
  }
}

function BrandPnl({
  rows,
}: {
  rows: Array<{
    id: string | null;
    name: string;
    revenue: Prisma.Decimal;
    net: Prisma.Decimal;
    margin: number | null;
  }>;
}) {
  if (rows.length === 0) {
    return <EmptyState>Belum ada jurnal bertag brand di periode ini.</EmptyState>;
  }
  const max = Math.max(...rows.map((r) => num(r.revenue)), 1);
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3.5">
        {rows.map((row) => {
          const rev = num(row.revenue);
          const width = rev > 0 ? Math.max(2, (rev / max) * 100) : 0;
          return (
            <li key={row.id ?? "untagged"} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span
                  className={cn(
                    "truncate font-medium",
                    row.id ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {row.name}
                </span>
                <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
                  <span className="text-foreground">{formatIdr(row.revenue)}</span>
                  <span
                    className={cn(
                      "w-12 text-right text-xs font-medium",
                      row.margin != null && row.margin < 0
                        ? "text-rose-700 dark:text-rose-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {row.margin == null ? "—" : `${row.margin.toFixed(0)}%`}
                  </span>
                </span>
              </div>
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${width}%` }}
                  title={`${row.name}: pendapatan ${formatIdr(row.revenue)}, laba ${formatIdr(row.net)}`}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground text-xs">
        Bar menunjukkan pendapatan; persentase di kanan adalah margin laba bersih.
      </p>
    </div>
  );
}

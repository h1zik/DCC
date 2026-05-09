import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Landmark,
  Lock,
  Plus,
  ScrollText,
  Workflow,
} from "lucide-react";
import { Prisma } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { FinanceClearDemoButton } from "@/components/finance/finance-clear-demo-button";
import { formatIdr } from "@/lib/finance-money";
import { cn } from "@/lib/utils";
import { loadFinanceDashboard } from "@/lib/finance-dashboard";
import { periodLabel } from "@/lib/finance-period";
import { PeriodSelector } from "./period-selector";
import { PeriodLockPanel } from "./period-lock-panel";
import { listFinancePeriodLocks } from "@/actions/finance-period-lock";

type SearchParams = { period?: string | string[] };

type Props = {
  searchParams: Promise<SearchParams>;
};

function parsePeriod(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const m = value?.match(/^(\d{4})-(\d{1,2})$/);
  const now = new Date();
  if (!m) return { year: now.getFullYear(), month: now.getMonth() + 1 };
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

function shortIdr(value: Prisma.Decimal | null | undefined): string {
  if (value == null) return "—";
  const n = Number(value.toString());
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 1 : 2)} M`;
  if (abs >= 1_000_000)
    return `${sign}Rp ${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)} Jt`;
  if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(0)} rb`;
  return formatIdr(value);
}

function pctText(p: number | null): string {
  if (p == null) return "—";
  const sign = p > 0 ? "+" : p < 0 ? "" : "";
  return `${sign}${p.toFixed(p >= 100 ? 0 : 1)}%`;
}

export default async function FinanceDashboardPage({ searchParams }: Props) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const [data, periodLocks] = await Promise.all([
    loadFinanceDashboard(period),
    listFinancePeriodLocks(8),
  ]);
  const isCurrentPeriodLocked = periodLocks.some(
    (l) => l.year === period.year && l.month === period.month,
  );

  const pendapatanProgress = (() => {
    const target = data.kpis.revenue.previous;
    const current = data.kpis.revenue.current;
    const t = Number(target.toString());
    const c = Number(current.toString());
    if (t <= 0) return null;
    return { current: c, target: t, pct: Math.min(120, (c / t) * 100) };
  })();

  const bebanProgress = (() => {
    const budget = data.kpis.expense.previous;
    const current = data.kpis.expense.current;
    const b = Number(budget.toString());
    const c = Number(current.toString());
    if (b <= 0) return null;
    return { current: c, target: b, pct: Math.min(120, (c / b) * 100) };
  })();

  const margin = (() => {
    const rev = Number(data.kpis.revenue.current.toString());
    if (rev <= 0) return null;
    return (Number(data.kpis.net.current.toString()) / rev) * 100;
  })();

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 pb-10">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className="border-primary/30 bg-primary/10 text-primary mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl border"
            aria-hidden
          >
            <Landmark className="size-5" />
          </span>
          <div className="space-y-1">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              Dashboard Keuangan
            </h1>
            <p className="text-muted-foreground text-sm">
              {formatDateLong(data.today)} — Periode berjalan{" "}
              <span className="text-foreground font-medium">
                {periodLabel(period.year, period.month)}
              </span>
              {isCurrentPeriodLocked ? (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  <Lock className="size-3" /> Periode terkunci
                </span>
              ) : null}
            </p>
          </div>
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
          <Button
            type="button"
            size="sm"
            nativeButton={false}
            render={<Link href="/finance/journals" />}
          >
            <Plus className="size-3.5" aria-hidden />
            Jurnal Baru
          </Button>
          <FinanceClearDemoButton />
        </div>
      </header>

      {/* Alerts */}
      <section
        aria-label="Peringatan keuangan"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <AlertCard
          tone="danger"
          icon={<AlertTriangle className="size-4" />}
          title={
            data.alerts.overdueArCount + data.alerts.overdueApCount > 0
              ? `${data.alerts.overdueArCount + data.alerts.overdueApCount} Invoice Overdue`
              : "Tidak ada invoice overdue"
          }
          subtitle={
            data.alerts.overdueArCount + data.alerts.overdueApCount > 0
              ? `Total ${shortIdr(data.alerts.overdueArTotal.plus(data.alerts.overdueApTotal))} — perlu follow-up`
              : "Semua tagihan masih dalam jadwal."
          }
          href="/finance/ap-ar"
        />
        <AlertCard
          tone="warning"
          icon={<Clock className="size-4" />}
          title={
            data.alerts.dueSoonCount > 0
              ? `${data.alerts.dueSoonCount} Jatuh Tempo 7 Hari`
              : "Tidak ada yang jatuh tempo minggu ini"
          }
          subtitle={
            data.alerts.dueSoonCount > 0
              ? `AP ${shortIdr(data.alerts.dueSoonAp)} · AR ${shortIdr(data.alerts.dueSoonAr)}`
              : "Aman untuk minggu ini."
          }
          href="/finance/ap-ar"
        />
        <AlertCard
          tone="info"
          icon={<Workflow className="size-4" />}
          title={
            data.alerts.reconPendingCount > 0
              ? `${data.alerts.reconPendingCount} Rekonsiliasi Pending`
              : "Semua rekonsiliasi selesai"
          }
          subtitle={
            data.alerts.reconPendingNames.length > 0
              ? `${data.alerts.reconPendingNames.slice(0, 3).join(", ")} belum selesai`
              : "Tidak ada bank yang perlu disesuaikan."
          }
          href="/finance/bank"
        />
      </section>

      {/* KPI cards */}
      <section
        aria-label="Indikator keuangan utama"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        <KpiCard
          label="Saldo Kas & Bank"
          value={shortIdr(data.kpis.cashAndBank)}
          delta={null}
          hint={
            data.bankAccountsCount > 0
              ? `${data.bankAccountsCount} rekening aktif`
              : "Belum ada rekening"
          }
        />
        <KpiCard
          label="Pendapatan MTD"
          value={shortIdr(data.kpis.revenue.current)}
          delta={data.kpis.revenue.deltaPct}
          progress={pendapatanProgress}
          hint={
            pendapatanProgress
              ? `Target (per. lalu): ${shortIdr(data.kpis.revenue.previous)}`
              : "Belum ada periode pembanding"
          }
        />
        <KpiCard
          label="Total Beban MTD"
          value={shortIdr(data.kpis.expense.current)}
          delta={data.kpis.expense.deltaPct}
          deltaInverse
          progress={bebanProgress}
          hint={
            bebanProgress
              ? `Budget ref. (per. lalu): ${shortIdr(data.kpis.expense.previous)}`
              : "Belum ada periode pembanding"
          }
        />
        <KpiCard
          label="Laba Bersih"
          value={shortIdr(data.kpis.net.current)}
          delta={data.kpis.net.deltaPct}
          hint={margin != null ? `Margin ${margin.toFixed(1)}%` : "—"}
        />
        <KpiCard
          label="Arus Kas Bersih"
          value={shortIdr(data.kpis.cash.current)}
          delta={data.kpis.cash.deltaPct}
          hint={`Inflow ${shortIdr(data.kpis.cash.inflow)} · Outflow ${shortIdr(data.kpis.cash.outflow)}`}
        />
      </section>

      {/* Aging tables */}
      <section
        aria-label="Aging hutang & piutang"
        className="grid gap-3 lg:grid-cols-2"
      >
        <Panel
          title="Aging Hutang (AP)"
          accent="rose"
          right={`Total ${shortIdr(data.aging.apTotal)}`}
          href="/finance/ap-ar"
        >
          {data.aging.ap.length === 0 ? (
            <EmptyRow message="Tidak ada hutang aktif." />
          ) : (
            <MiniTable
              head={["Vendor", "Jumlah", "Umur", "Status"]}
              widths={["minmax(0,1.6fr)", "minmax(0,1fr)", "auto", "auto"]}
            >
              {data.aging.ap.map((row) => (
                <MiniRow
                  key={row.id}
                  cells={[
                    <span key="v" className="text-foreground truncate text-sm font-medium">
                      {row.vendorName}
                    </span>,
                    <span key="a" className="text-foreground text-sm tabular-nums">
                      {shortIdr(row.remaining)}
                    </span>,
                    <span key="u" className="text-muted-foreground text-xs">
                      {agingHumanLabel(row.status)}
                    </span>,
                    <StatusChip key="s" status={row.status} />,
                  ]}
                />
              ))}
            </MiniTable>
          )}
        </Panel>
        <Panel
          title="Aging Piutang (AR)"
          accent="emerald"
          right={`Total ${shortIdr(data.aging.arTotal)}`}
          href="/finance/ap-ar"
        >
          {data.aging.ar.length === 0 ? (
            <EmptyRow message="Tidak ada piutang aktif." />
          ) : (
            <MiniTable
              head={["Customer", "Jumlah", "Umur", "Status"]}
              widths={["minmax(0,1.6fr)", "minmax(0,1fr)", "auto", "auto"]}
            >
              {data.aging.ar.map((row) => (
                <MiniRow
                  key={row.id}
                  cells={[
                    <span key="c" className="text-foreground truncate text-sm font-medium">
                      {row.customerName}
                    </span>,
                    <span key="a" className="text-foreground text-sm tabular-nums">
                      {shortIdr(row.remaining)}
                    </span>,
                    <span key="u" className="text-muted-foreground text-xs">
                      {agingHumanLabel(row.status)}
                    </span>,
                    <StatusChip key="s" status={row.status} />,
                  ]}
                />
              ))}
            </MiniTable>
          )}
        </Panel>
      </section>

      {/* Bank reconciliation, recent journals, P&L per brand */}
      <section
        aria-label="Status bank, jurnal terakhir & P&L per brand"
        className="grid gap-3 lg:grid-cols-3"
      >
        <Panel
          title="Rekonsiliasi Bank"
          accent="sky"
          right={
            data.banks.length > 0
              ? `${data.banks.filter((b) => b.totalLines > 0 && b.progress >= 100).length}/${data.banks.length} selesai`
              : "—"
          }
          href="/finance/bank"
        >
          {data.banks.length === 0 ? (
            <EmptyRow message="Belum ada rekening bank yang dikonfigurasi." />
          ) : (
            <ul className="flex flex-col gap-3">
              {data.banks.map((bank) => (
                <li key={bank.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground truncate font-medium">
                      {bank.name}
                      {bank.mask ? (
                        <span className="text-muted-foreground"> ··{bank.mask}</span>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {bank.totalLines === 0
                        ? "Belum impor"
                        : `${bank.matchedLines}/${bank.totalLines}`}
                    </span>
                  </div>
                  <div className="bg-muted/60 relative h-2 w-full overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-all",
                        bank.totalLines === 0
                          ? "bg-muted-foreground/30"
                          : bank.progress >= 100
                            ? "bg-emerald-500"
                            : bank.progress >= 50
                              ? "bg-amber-500"
                              : "bg-rose-500",
                      )}
                      style={{ width: `${Math.max(2, bank.progress)}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    {bank.totalLines === 0
                      ? "Tidak ada baris mutasi"
                      : bank.progress >= 100
                        ? "Selesai"
                        : `${bank.progress}% ter-rekonsiliasi`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Jurnal Terakhir"
          accent="violet"
          right={
            <Link
              href="/finance/journals"
              className="text-primary hover:underline"
            >
              Lihat semua →
            </Link>
          }
        >
          {data.recentJournals.length === 0 ? (
            <EmptyRow message="Belum ada jurnal yang diposting." />
          ) : (
            <ul className="flex flex-col">
              {data.recentJournals.map((row) => (
                <li
                  key={row.id}
                  className="border-border/60 flex items-center justify-between gap-3 border-b py-2 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-[11px] tabular-nums">
                      {formatDateShort(row.date)}
                    </p>
                    <Link
                      href={`/finance/journals/${row.id}`}
                      className="text-foreground hover:text-primary line-clamp-1 text-sm font-medium"
                    >
                      {row.memo?.trim() ||
                        row.reference?.trim() ||
                        "Tanpa keterangan"}
                    </Link>
                  </div>
                  <span className="text-foreground shrink-0 text-sm font-semibold tabular-nums">
                    {shortIdr(row.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="P&L per Brand"
          accent="amber"
          right={periodLabel(period.year, period.month)}
          href="/finance/brands-costing"
        >
          {data.brandPnl.length === 0 ? (
            <EmptyRow message="Belum ada aktivitas brand untuk periode ini." />
          ) : (
            <MiniTable
              head={["Brand", "Revenue", "Margin"]}
              widths={["minmax(0,1.4fr)", "minmax(0,1fr)", "auto"]}
            >
              {data.brandPnl.slice(0, 6).map((row) => (
                <MiniRow
                  key={row.id ?? "untagged"}
                  cells={[
                    <span key="n" className="text-foreground truncate text-sm font-medium">
                      {row.name}
                    </span>,
                    <span key="r" className="text-foreground text-sm tabular-nums">
                      {shortIdr(row.revenue)}
                    </span>,
                    <span
                      key="m"
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                        row.margin == null
                          ? "bg-muted text-muted-foreground"
                          : row.margin >= 20
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : row.margin >= 0
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              : "bg-rose-500/15 text-rose-700 dark:text-rose-300",
                      )}
                    >
                      {row.margin == null ? "—" : `${row.margin.toFixed(0)}%`}
                    </span>,
                  ]}
                />
              ))}
            </MiniTable>
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

function KpiCard({
  label,
  value,
  delta,
  hint,
  progress,
  deltaInverse = false,
}: {
  label: string;
  value: string;
  delta: number | null;
  hint?: string;
  progress?: { current: number; target: number; pct: number } | null;
  /** Untuk metric beban: kenaikan = jelek (merah), penurunan = bagus (hijau). */
  deltaInverse?: boolean;
}) {
  const tone = (() => {
    if (delta == null) return "neutral" as const;
    if (delta === 0) return "neutral" as const;
    const positive = delta > 0;
    const isGood = deltaInverse ? !positive : positive;
    return isGood ? ("up" as const) : ("down" as const);
  })();

  return (
    <div className="border-border bg-card relative isolate flex flex-col gap-2 overflow-hidden rounded-xl border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.06em] uppercase">
          {label}
        </p>
        {delta != null ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              tone === "up"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : tone === "down"
                  ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {tone === "up" ? (
              <ArrowUpRight className="size-3" aria-hidden />
            ) : tone === "down" ? (
              <ArrowDownRight className="size-3" aria-hidden />
            ) : null}
            {pctText(delta)}
          </span>
        ) : null}
      </div>
      <p className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {progress ? (
        <div className="mt-1 space-y-1">
          <div className="bg-muted/60 relative h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                deltaInverse
                  ? progress.pct > 100
                    ? "bg-rose-500"
                    : progress.pct > 80
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  : progress.pct >= 100
                    ? "bg-emerald-500"
                    : progress.pct >= 60
                      ? "bg-amber-500"
                      : "bg-primary",
              )}
              style={{ width: `${Math.min(100, progress.pct)}%` }}
            />
          </div>
        </div>
      ) : null}
      {hint ? (
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function AlertCard({
  tone,
  icon,
  title,
  subtitle,
  href,
}: {
  tone: "danger" | "warning" | "info";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  href: string;
}) {
  const tones = {
    danger:
      "border-rose-500/35 bg-rose-500/8 text-rose-700 dark:text-rose-300",
    warning:
      "border-amber-500/35 bg-amber-500/8 text-amber-700 dark:text-amber-300",
    info:
      "border-sky-500/35 bg-sky-500/8 text-sky-700 dark:text-sky-300",
  } as const;
  return (
    <Link
      href={href}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 shadow-sm transition-colors hover:shadow-md",
        tones[tone],
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-background/40",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        <p className="text-foreground/80 truncate text-xs leading-relaxed">
          {subtitle}
        </p>
      </div>
    </Link>
  );
}

function Panel({
  title,
  accent,
  children,
  right,
  href,
}: {
  title: string;
  accent: "rose" | "emerald" | "sky" | "violet" | "amber";
  children: React.ReactNode;
  right?: React.ReactNode;
  href?: string;
}) {
  const dot: Record<typeof accent, string> = {
    rose: "bg-rose-500",
    emerald: "bg-emerald-500",
    sky: "bg-sky-500",
    violet: "bg-violet-500",
    amber: "bg-amber-500",
  };
  const titleEl = (
    <span className="text-foreground inline-flex items-center gap-2 text-sm font-semibold">
      <span className={cn("size-2 rounded-full", dot[accent])} aria-hidden />
      {title}
    </span>
  );
  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        {href ? (
          <Link href={href} className="hover:text-primary transition-colors">
            {titleEl}
          </Link>
        ) : (
          titleEl
        )}
        {right ? (
          <span className="text-muted-foreground text-[11px] font-medium">
            {right}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function MiniTable({
  head,
  widths,
  children,
}: {
  head: string[];
  widths: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        role="row"
        className="text-muted-foreground border-border/60 grid items-center gap-3 border-b pb-2 text-[10px] font-semibold tracking-wide uppercase"
        style={{ gridTemplateColumns: widths.join(" ") }}
      >
        {head.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function MiniRow({ cells }: { cells: React.ReactNode[] }) {
  const cols = cells.length;
  return (
    <li
      className="border-border/60 grid items-center gap-3 border-b py-2 last:border-0"
      style={{
        gridTemplateColumns:
          cols === 4
            ? "minmax(0,1.6fr) minmax(0,1fr) auto auto"
            : "minmax(0,1.4fr) minmax(0,1fr) auto",
      }}
    >
      {cells}
    </li>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <p className="border-border/60 text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-xs">
      <CheckCircle2 className="text-muted-foreground/60 mx-auto mb-1 size-4" />
      {message}
    </p>
  );
}

function StatusChip({
  status,
}: {
  status:
    | { kind: "overdue"; days: number }
    | { kind: "due-soon"; days: number }
    | { kind: "on-track" }
    | { kind: "paid" };
}) {
  switch (status.kind) {
    case "overdue":
      return (
        <span className="inline-flex items-center rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300">
          Overdue
        </span>
      );
    case "due-soon":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
          {status.days <= 0 ? "Hari ini" : `${status.days} hr lagi`}
        </span>
      );
    case "on-track":
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
          On track
        </span>
      );
    case "paid":
      return (
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          Lunas
        </span>
      );
  }
}

function agingHumanLabel(
  status:
    | { kind: "overdue"; days: number }
    | { kind: "due-soon"; days: number }
    | { kind: "on-track" }
    | { kind: "paid" },
): string {
  switch (status.kind) {
    case "overdue":
      return `${status.days} hari lewat`;
    case "due-soon":
      return status.days <= 0 ? "hari ini" : `${status.days} hari lagi`;
    case "on-track":
      return "≥ 8 hari";
    case "paid":
      return "lunas";
  }
}

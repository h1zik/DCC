import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExecFinanceData, FinKpi } from "@/lib/executive-dashboard";
import { formatIdrShort, formatSignedPercent } from "@/lib/finance-format";
import { periodLabel } from "@/lib/finance-period";
import { cn } from "@/lib/utils";

const IDR_FULL = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** Arah "baik": pendapatan/laba naik = baik; beban naik = perlu diperhatikan. */
function DeltaChip({ kpi, upIsGood }: { kpi: FinKpi; upIsGood: boolean }) {
  const d = kpi.deltaPct;
  if (d == null) {
    return (
      <span className="text-xs text-muted-foreground">
        Bulan lalu {formatIdrShort(kpi.previous)}
      </span>
    );
  }
  const flat = Math.abs(d) < 0.05;
  const good = flat ? null : d > 0 === upIsGood;
  const Icon = flat ? Minus : d > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium tabular-nums",
          good == null && "bg-muted text-muted-foreground",
          good === true &&
            "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          good === false && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        )}
      >
        <Icon className="size-3" aria-hidden />
        {formatSignedPercent(d)}
      </span>
      <span className="text-muted-foreground">vs bulan lalu</span>
    </span>
  );
}

function StatTile({
  label,
  value,
  children,
  negative,
}: {
  label: string;
  value: number;
  children?: React.ReactNode;
  negative?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-muted/30 px-4 py-3.5">
      <span className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </span>
      <span
        title={IDR_FULL.format(value)}
        className={cn(
          "font-mono text-xl font-semibold tracking-tight tabular-nums sm:text-2xl",
          negative ? "text-destructive" : "text-foreground",
        )}
      >
        {formatIdrShort(value)}
      </span>
      {children}
    </div>
  );
}

function ObligationRow({
  href,
  label,
  count,
  total,
  tone,
}: {
  href: string;
  label: string;
  count: number;
  total: number;
  tone: "danger" | "warning" | "info";
}) {
  const active = count > 0;
  return (
    <li>
      <Link
        href={href}
        className="group/row flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              !active && "bg-muted-foreground/30",
              active && tone === "danger" && "bg-destructive",
              active && tone === "warning" && "bg-amber-500",
              active && tone === "info" && "bg-sky-500",
            )}
          />
          <span className="truncate text-sm text-foreground">{label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-right text-sm tabular-nums">
            <span className="font-mono font-medium text-foreground">{count}</span>
            {active ? (
              <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                {formatIdrShort(total)}
              </span>
            ) : null}
          </span>
          <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover/row:translate-x-0.5" />
        </span>
      </Link>
    </li>
  );
}

export function ExecFinanceSnapshot({ data }: { data: ExecFinanceData | null }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Ringkasan keuangan</CardTitle>
          <CardDescription>
            {data
              ? `${periodLabel(data.period.year, data.period.month)} — jurnal berstatus posted, dibanding bulan sebelumnya.`
              : "Data keuangan tidak dapat dimuat saat ini."}
          </CardDescription>
        </div>
        <Link
          href="/finance"
          className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Buka Finance
        </Link>
      </CardHeader>
      <CardContent>
        {!data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Coba muat ulang beberapa saat lagi.
          </p>
        ) : !data.hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Belum ada jurnal yang diposting bulan ini.
          </p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatTile label="Pendapatan" value={data.revenue.current}>
                <DeltaChip kpi={data.revenue} upIsGood />
              </StatTile>
              <StatTile label="Beban" value={data.expense.current}>
                <DeltaChip kpi={data.expense} upIsGood={false} />
              </StatTile>
              <StatTile
                label="Laba bersih"
                value={data.net.current}
                negative={data.net.current < 0}
              >
                <DeltaChip kpi={data.net} upIsGood />
              </StatTile>
              <StatTile label="Kas & bank" value={data.cashAndBank}>
                <span className="text-xs tabular-nums text-muted-foreground">
                  Masuk {formatIdrShort(data.cashInflow)} · Keluar{" "}
                  {formatIdrShort(data.cashOutflow)}
                </span>
              </StatTile>
            </div>

            <div className="flex flex-col gap-2">
              <p className="px-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Kewajiban &amp; persetujuan
              </p>
              <ul className="flex flex-col">
                <ObligationRow
                  href="/finance/ap-ar"
                  label="Piutang jatuh tempo"
                  count={data.arOverdue.count}
                  total={data.arOverdue.total}
                  tone="warning"
                />
                <ObligationRow
                  href="/finance/ap-ar"
                  label="Tagihan vendor jatuh tempo"
                  count={data.apOverdue.count}
                  total={data.apOverdue.total}
                  tone="danger"
                />
                <ObligationRow
                  href="/finance/approvals"
                  label="Pengajuan dana menunggu"
                  count={data.pendingSpend.count}
                  total={data.pendingSpend.total}
                  tone="info"
                />
              </ul>
              {data.budgetOverruns.length > 0 ? (
                <Link
                  href="/finance/budget"
                  className="mx-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 transition-colors hover:bg-amber-500/10"
                >
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    Anggaran terlampaui
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {data.budgetOverruns.map((b) => (
                      <li
                        key={b.label}
                        className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
                      >
                        <span className="min-w-0 truncate">{b.label}</span>
                        <span className="shrink-0 font-mono tabular-nums text-foreground">
                          {b.usagePct}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import Link from "next/link";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  ArrowUpRight,
  Boxes,
  Clock,
  Factory,
  ListChecks,
  Package,
  Rocket,
} from "lucide-react";
import { auth } from "@/lib/auth";
import {
  buildExecInsights,
  getExecCore,
  getExecOutgoing,
  parseExecRange,
} from "@/lib/executive-dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExecRangeSelector } from "@/components/executive/exec-range-selector";
import { ExecInsightStrip } from "@/components/executive/exec-insight-strip";
import { ExecFinanceSnapshot } from "@/components/executive/exec-finance-snapshot";
import { ExecOutgoingTrend } from "@/components/executive/exec-outgoing-trend";
import { ExecOutgoingByBrand } from "@/components/executive/exec-outgoing-by-brand";
import { ExecSkuPerformance } from "@/components/executive/exec-sku-performance";
import { ExecTeamHealth } from "@/components/executive/exec-team-health";
import {
  ExecCriticalStock,
  ExecMilestones,
  ExecPoForecast,
} from "@/components/executive/exec-operations-cards";
import { ExecutiveKpiCard } from "./executive-kpi-card";

type SearchParams = { range?: string | string[] };

export default async function ExecutiveDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Guard di luar fungsi ber-cache: auth() membaca cookie.
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.CEO) redirect("/inventory");

  const range = parseExecRange((await searchParams).range);
  const [core, outgoing] = await Promise.all([
    getExecCore(),
    getExecOutgoing(range),
  ]);
  const { kpi, approvals } = core;

  const insights = buildExecInsights(core, outgoing);
  const pendingApprovals = approvals.task + approvals.pipeline;
  const attentionPct =
    kpi.activeSkus > 0
      ? Math.round((kpi.attentionCount / kpi.activeSkus) * 100)
      : 0;
  const todayLabel = format(new Date(), "EEEE, d MMMM yyyy", { locale: idLocale });

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-border/70 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              {todayLabel}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Executive overview
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              PT Dominatus Clean Solution — keuangan, pergerakan barang, stok,
              tim, dan jalur produksi.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ExecRangeSelector value={range} />
            <Button
              nativeButton={false}
              render={<Link href="/approvals" />}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <ListChecks className="size-4" />
              Persetujuan
              {pendingApprovals > 0 ? (
                <Badge variant="destructive" className="ml-0.5">
                  {pendingApprovals}
                </Badge>
              ) : null}
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/inventory" />}
              size="sm"
              className="gap-2"
            >
              Kelola stok
              <ArrowUpRight className="size-4" />
            </Button>
          </div>
        </div>
        <ExecInsightStrip insights={insights} />
      </header>

      <section
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        aria-label="Metrik utama"
      >
        <ExecutiveKpiCard
          label="SKU aktif"
          value={kpi.activeSkus}
          description="Total produk terdaftar"
          icon={<Package className="size-4" />}
          tone="neutral"
        />
        <ExecutiveKpiCard
          label="Supplier aktif"
          value={kpi.activeSuppliers}
          description="Vendor / maklon terdaftar"
          icon={<Factory className="size-4" />}
          tone="neutral"
        />
        <ExecutiveKpiCard
          label="Stok perlu perhatian"
          value={kpi.attentionCount}
          description={`${attentionPct}% dari total SKU`}
          icon={<Boxes className="size-4" />}
          tone={kpi.attentionCount > 0 ? "warning" : "success"}
          indicator={attentionPct}
        />
        <ExecutiveKpiCard
          label="Tugas overdue"
          value={kpi.overdueTasks}
          description={
            kpi.incompleteTasks > 0 ? (
              <>
                Seluruh ruangan ·{" "}
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {kpi.incompleteTasks} belum ada tenggat/PIC
                </span>
              </>
            ) : (
              "Seluruh ruangan & proyek"
            )
          }
          icon={<Clock className="size-4" />}
          tone={kpi.overdueTasks > 0 ? "danger" : "success"}
          indicator={kpi.overdueTasks > 0 ? 100 : 0}
          href="/overdue"
          ctaLabel="Lihat & selesaikan"
        />
        <ExecutiveKpiCard
          label="Siap peluncuran"
          value={kpi.readyLaunchProjects}
          description="Semua milestone selesai"
          icon={<Rocket className="size-4" />}
          tone={kpi.readyLaunchProjects > 0 ? "accent" : "neutral"}
        />
        <ExecutiveKpiCard
          label="Menunggu Anda"
          value={pendingApprovals}
          description={`${approvals.task} tugas · ${approvals.pipeline} pipeline`}
          icon={<ListChecks className="size-4" />}
          tone={pendingApprovals > 0 ? "accent" : "neutral"}
          href="/approvals"
          ctaLabel="Buka persetujuan"
          indicator={pendingApprovals > 0 ? 100 : 0}
        />
      </section>

      <ExecFinanceSnapshot data={core.finance} />

      <section
        className="grid gap-4 xl:grid-cols-[1.6fr_1fr]"
        aria-label="Pergerakan barang"
      >
        <ExecOutgoingTrend data={outgoing} />
        <ExecOutgoingByBrand data={outgoing} />
      </section>

      <ExecSkuPerformance data={outgoing} />

      <section className="grid gap-4 xl:grid-cols-2">
        <ExecTeamHealth kpi={kpi} team={core.team} />
        <ExecPoForecast rows={core.forecastPoSoon} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ExecCriticalStock rows={core.critical} />
        <ExecMilestones rows={core.milestones} avgPct={kpi.avgMilestoneProgress} />
      </section>

      <p className="text-xs text-muted-foreground">
        Rentang {range} hari berlaku untuk data barang keluar. Keuangan memakai
        bulan berjalan; forecast PO selalu 90 hari. Data diperbarui tiap ±1 menit.
      </p>
    </div>
  );
}

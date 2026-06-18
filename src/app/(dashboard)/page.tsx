import Link from "next/link";
import { StockLogType, TaskStatus, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Clock,
  Factory,
  ListChecks,
  Package,
  Rocket,
  TrendingUp,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStockHealth, needsUrgentReorder } from "@/lib/stock-status";
import { computeMilestoneProgress } from "@/lib/project-milestones";
import {
  computeReorderForecasts,
  forecastProductInclude,
  reorderStatusLabel,
  toForecastProductInput,
} from "@/lib/reorder-forecast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExecutiveKpiCard } from "./executive-kpi-card";

type SalesLogRow = {
  id: string;
  amount: number;
  type: StockLogType;
  salesCategory: string | null;
  note: string | null;
  product: { brand: { name: string } };
};

function isSystemLog(row: SalesLogRow): boolean {
  return (row.note ?? "").startsWith("[SYS]");
}

function parseSystemMeta(row: SalesLogRow): {
  action: "REVERSAL" | "REPLACEMENT" | "VOID" | null;
  targetId: string | null;
} {
  const raw = (row.note ?? "").trim();
  if (!raw.startsWith("[SYS]")) return { action: null, targetId: null };

  if (raw.startsWith("[SYS] |")) {
    const parts = raw.split("|").map((x) => x.trim());
    const action = parts.find((p) => p.startsWith("action="))?.slice(7) ?? "";
    const targetId = parts.find((p) => p.startsWith("target="))?.slice(7) ?? "";
    return {
      action:
        action === "REVERSAL" || action === "REPLACEMENT" || action === "VOID"
          ? action
          : null,
      targetId: targetId || null,
    };
  }

  const m = raw
    .replace(/^\[SYS\]\s*/i, "")
    .match(/^(REVERSAL|REPLACEMENT|VOID)\s+untuk\s+(\S+)/i);
  return {
    action: m?.[1]
      ? (m[1].toUpperCase() as "REVERSAL" | "REPLACEMENT" | "VOID")
      : null,
    targetId: m?.[2] ?? null,
  };
}

const getExecutiveDashboardData = unstable_cache(
  async () => {
    const [
      products,
      milestoneProjects,
      salesLogs,
      activeSuppliers,
      overdueTasks,
      pendingTaskApprovals,
    ] = await Promise.all([
      prisma.product.findMany({
        include: {
          brand: { select: { name: true } },
          ...forecastProductInclude,
        },
        orderBy: { name: "asc" },
      }),
      prisma.project.findMany({
        where: { brandId: { not: null } },
        select: {
          id: true,
          name: true,
          brand: { select: { name: true } },
          milestones: { select: { status: true, parentId: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      prisma.stockLog.findMany({
        where: {
          type: StockLogType.OUT,
          createdAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          amount: true,
          type: true,
          salesCategory: true,
          note: true,
          product: { select: { brand: { select: { name: true } } } },
        },
      }),
      prisma.vendor.count(),
      prisma.task.count({
        where: { status: TaskStatus.OVERDUE, archivedAt: null },
      }),
      prisma.task.count({
        where: { isApprovalRequired: true, isApproved: false },
      }),
    ]);

    const pendingApprovals = pendingTaskApprovals;

    const projectMilestoneRows = milestoneProjects.map((p) => ({
      id: p.id,
      name: p.name,
      brandName: p.brand?.name ?? "—",
      pct: computeMilestoneProgress(p.milestones),
    }));
    const avgMilestoneProgress =
      projectMilestoneRows.length > 0
        ? Math.round(
            projectMilestoneRows.reduce((acc, p) => acc + p.pct, 0) /
              projectMilestoneRows.length,
          )
        : 0;
    const readyLaunchProjects = projectMilestoneRows.filter(
      (p) => p.pct >= 100,
    ).length;
    const activeSkus = products.length;
    const attentionCount = products.filter(
      (p) => getStockHealth(p.currentStock, p.minStock) !== "OK",
    ).length;
    const critical = products.filter((p) =>
      needsUrgentReorder(p.currentStock, p.minStock),
    );

    const forecasts = await computeReorderForecasts(
      products.map((p) => toForecastProductInput(p)),
      90,
    );
    const forecastPoSoon = forecasts
      .filter((f) => f.status === "ORDER_NOW" || f.status === "ORDER_SOON")
      .sort((a, b) => {
        const ta = a.orderByDate?.getTime() ?? 0;
        const tb = b.orderByDate?.getTime() ?? 0;
        return ta - tb;
      })
      .slice(0, 5);

    const businessLogs = salesLogs.filter((row): row is SalesLogRow => !isSystemLog(row));
    const correctionLogs = salesLogs.filter((row): row is SalesLogRow => isSystemLog(row));

    const replacementByTargetId = new Map<string, SalesLogRow>();
    const voidTargetIds = new Set<string>();
    for (const row of correctionLogs) {
      const meta = parseSystemMeta(row);
      if (!meta.targetId) continue;
      if (meta.action === "REPLACEMENT") replacementByTargetId.set(meta.targetId, row);
      if (meta.action === "VOID") voidTargetIds.add(meta.targetId);
    }

    const effectiveSalesLogs = businessLogs
      .filter((row) => !voidTargetIds.has(row.id))
      .map((row) => replacementByTargetId.get(row.id) ?? row)
      .filter((row) => row.type === StockLogType.OUT);

    const pcsByBrand = effectiveSalesLogs.reduce<
      Record<string, { total: number; sales: number; sampling: number }>
    >((acc, row) => {
      const key = row.product.brand.name.trim() || "Tanpa brand";
      const current = acc[key] ?? { total: 0, sales: 0, sampling: 0 };
      current.total += row.amount;
      if (row.salesCategory === "sampling") current.sampling += row.amount;
      else current.sales += row.amount;
      acc[key] = current;
      return acc;
    }, {});
    const outgoingByBrandRows = Object.entries(pcsByBrand).sort(
      (a, b) => b[1].total - a[1].total,
    );
    const totalOutgoingUnits = outgoingByBrandRows.reduce(
      (acc, [, v]) => acc + v.total,
      0,
    );

    return {
      activeSkus,
      activeSuppliers,
      attentionCount,
      overdueTasks,
      readyLaunchProjects,
      pendingApprovals,
      critical,
      forecastPoSoon,
      projectMilestoneRows,
      avgMilestoneProgress,
      outgoingByBrandRows,
      totalOutgoingUnits,
    };
  },
  ["executive-dashboard-metrics"],
  { revalidate: 60 },
);

export default async function ExecutiveDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== UserRole.CEO) redirect("/inventory");
  const {
    activeSkus,
    activeSuppliers,
    attentionCount,
    overdueTasks,
    readyLaunchProjects,
    pendingApprovals,
    critical,
    forecastPoSoon,
    projectMilestoneRows,
    avgMilestoneProgress,
    outgoingByBrandRows,
    totalOutgoingUnits,
  } = await getExecutiveDashboardData();

  const maxBrandTotal = outgoingByBrandRows.reduce(
    (m, [, v]) => Math.max(m, v.total),
    0,
  );
  const attentionPct =
    activeSkus > 0 ? Math.round((attentionCount / activeSkus) * 100) : 0;
  const todayLabel = format(new Date(), "EEEE, d MMMM yyyy", { locale: idLocale });

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Hero header — compact, scannable */}
      <header className="flex flex-col gap-3 border-b border-border/70 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              {todayLabel}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Executive overview
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              PT Dominatus Clean Solution — visibilitas stok, merek, dan jalur
              produksi.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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

        {/* Critical alert — inline banner, dismissible-looking but persistent */}
        {critical.length > 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-destructive">
                {critical.length} SKU memerlukan reorder segera
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Stok nol atau di bawah ambang kritis — koordinasikan dengan staf
                logistik.
              </p>
            </div>
            <Link
              href="/inventory"
              className="shrink-0 text-xs font-semibold text-destructive underline-offset-4 hover:underline"
            >
              Lihat detail
            </Link>
          </div>
        ) : null}
      </header>

      {/* KPI grid — 6 metrics in a dense, scannable row */}
      <section
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        aria-label="Metrik utama"
      >
        <ExecutiveKpiCard
          label="SKU aktif"
          value={activeSkus}
          description="Total produk terdaftar"
          icon={<Package className="size-4" />}
          tone="neutral"
        />
        <ExecutiveKpiCard
          label="Supplier aktif"
          value={activeSuppliers}
          description="Vendor / maklon terdaftar"
          icon={<Factory className="size-4" />}
          tone="neutral"
        />
        <ExecutiveKpiCard
          label="Stok perlu perhatian"
          value={attentionCount}
          description={`${attentionPct}% dari total SKU`}
          icon={<Boxes className="size-4" />}
          tone={attentionCount > 0 ? "warning" : "success"}
          indicator={attentionPct}
        />
        <ExecutiveKpiCard
          label="Tugas overdue"
          value={overdueTasks}
          description="Seluruh proyek (Tahap 2)"
          icon={<Clock className="size-4" />}
          tone={overdueTasks > 0 ? "danger" : "success"}
          indicator={overdueTasks > 0 ? 100 : 0}
        />
        <ExecutiveKpiCard
          label="Siap peluncuran"
          value={readyLaunchProjects}
          description="Semua milestone selesai"
          icon={<Rocket className="size-4" />}
          tone={readyLaunchProjects > 0 ? "accent" : "neutral"}
        />
        <ExecutiveKpiCard
          label="Menunggu Anda"
          value={pendingApprovals}
          description="Pengajuan pindah tahap pipeline"
          icon={<ListChecks className="size-4" />}
          tone={pendingApprovals > 0 ? "accent" : "neutral"}
          href="/approvals"
          ctaLabel="Buka persetujuan"
          indicator={pendingApprovals > 0 ? 100 : 0}
        />
      </section>

      {/* Operational row — outgoing per brand + PO forecast */}
      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-4 text-accent" />
                Barang keluar per brand
              </CardTitle>
              <CardDescription>
                Akumulasi PCS stok keluar 90 hari terakhir — penjualan vs
                sampling.
              </CardDescription>
            </div>
            {totalOutgoingUnits > 0 ? (
              <span className="shrink-0 rounded-lg bg-muted/60 px-2.5 py-1 font-mono text-xs tabular-nums text-muted-foreground">
                {totalOutgoingUnits.toLocaleString("id-ID")} PCS total
              </span>
            ) : null}
          </CardHeader>
          <CardContent>
            {outgoingByBrandRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada transaksi barang keluar.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {outgoingByBrandRows.map(([brand, value]) => {
                  const sharePct =
                    maxBrandTotal > 0
                      ? Math.round((value.total / maxBrandTotal) * 100)
                      : 0;
                  const salesPct =
                    value.total > 0
                      ? Math.round((value.sales / value.total) * 100)
                      : 0;
                  return (
                    <li key={brand} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium text-foreground">
                          {brand}
                        </span>
                        <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                          {value.total.toLocaleString("id-ID")} PCS
                        </span>
                      </div>
                      <div
                        className="relative h-2 w-full overflow-hidden rounded-full bg-muted/50"
                        role="progressbar"
                        aria-valuenow={sharePct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-accent/80"
                          style={{ width: `${sharePct}%` }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-accent-foreground/15"
                          style={{ width: `${(sharePct * salesPct) / 100}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>
                          Penjualan{" "}
                          <span className="font-mono tabular-nums text-foreground/80">
                            {value.sales.toLocaleString("id-ID")}
                          </span>
                        </span>
                        <span>
                          Sampling{" "}
                          <span className="font-mono tabular-nums text-foreground/80">
                            {value.sampling.toLocaleString("id-ID")}
                          </span>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[280px]">
          <CardHeader>
            <CardTitle>SKU perlu PO (forecast)</CardTitle>
            <CardDescription>
              Burn rate penjualan 90 hari + lead time vendor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {forecastPoSoon.length === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Package className="size-5" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  Stok aman minggu ini
                </p>
                <p className="text-xs text-muted-foreground">
                  Tidak ada SKU yang perlu PO menurut forecast.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[220px] pr-3">
                <ul className="flex flex-col gap-2.5">
                  {forecastPoSoon.map((f) => (
                    <li
                      key={f.productId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {f.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {f.brandName} · stok {f.currentStock} · burn{" "}
                          <span className="font-mono tabular-nums">
                            {f.avgDailyDemand.toFixed(1)}/hari
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge
                          variant={
                            f.status === "ORDER_NOW" ? "destructive" : "secondary"
                          }
                        >
                          {reorderStatusLabel(f.status)}
                        </Badge>
                        {f.orderByDate ? (
                          <p className="text-xs text-muted-foreground">
                            Order sebelum{" "}
                            <span className="font-medium text-foreground">
                              {format(f.orderByDate, "d MMM", { locale: idLocale })}
                            </span>
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Pipeline + critical stock row */}
      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="min-h-[280px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              Stok kritis
            </CardTitle>
            <CardDescription>
              Reorder segera — stok nol atau di bawah ambang kritis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {critical.length === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Boxes className="size-5" />
                </span>
                <p className="text-sm font-medium text-foreground">
                  Tidak ada SKU kritis
                </p>
                <p className="text-xs text-muted-foreground">
                  Semua produk di atas ambang kritis.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[220px] pr-3">
                <ul className="flex flex-col gap-2.5">
                  {critical.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {p.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {p.brand.name} · SKU {p.sku}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="destructive">Stok {p.currentStock}</Badge>
                        <Link
                          href="/inventory"
                          className="text-xs font-medium text-destructive underline-offset-4 hover:underline"
                        >
                          Reorder
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Progress milestone proyek</CardTitle>
              <CardDescription>
                Rata-rata{" "}
                <span className="font-semibold text-foreground">
                  {avgMilestoneProgress}%
                </span>{" "}
                — pantau detail di Pipeline proyek.
              </CardDescription>
            </div>
            <Button
              nativeButton={false}
              render={<Link href="/projects" />}
              variant="outline"
              size="sm"
            >
              Buka pipeline
            </Button>
          </CardHeader>
          <CardContent>
            {projectMilestoneRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada proyek ber-brand.
              </p>
            ) : (
              <ul className="space-y-3.5">
                {projectMilestoneRows.map((p) => {
                  const done = p.pct >= 100;
                  return (
                    <li key={p.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate font-medium text-foreground">
                          {p.name}
                          <span className="font-normal text-muted-foreground">
                            {" · "}
                            {p.brandName}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 font-semibold tabular-nums",
                            done
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-foreground",
                          )}
                        >
                          {p.pct}%
                        </span>
                      </div>
                      <Progress
                        value={p.pct}
                        className={cn(
                          "gap-0",
                          done && "[&_[data-slot=progress-indicator]]:bg-emerald-500",
                        )}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
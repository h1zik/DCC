import "server-only";
import { FinanceSpendRequestStatus, TaskStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getTodayDateString } from "@/lib/attendance";
import { getStockHealth, needsUrgentReorder } from "@/lib/stock-status";
import { computeMilestoneProgress } from "@/lib/project-milestones";
import {
  computeReorderForecasts,
  forecastProductInclude,
  toForecastProductInput,
} from "@/lib/reorder-forecast";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import { loadFinanceDashboard } from "@/lib/finance-dashboard";
import { formatIdrShort } from "@/lib/finance-format";
import { aiGetAttendanceSummary } from "@/lib/ai-api/extended-queries";
import { aiGetBudgetVsActual } from "@/lib/ai-api/strategic-queries";
import { loadOutgoingAggregate } from "@/lib/ai-api/executive-metrics";
import type { OutgoingAggregate } from "@/lib/outgoing-metrics";
import { EXEC_DASHBOARD_TAG } from "@/lib/executive-dashboard-tag";

export const EXEC_RANGES = [30, 90, 180] as const;
export type ExecRange = (typeof EXEC_RANGES)[number];
export const DEFAULT_EXEC_RANGE: ExecRange = 90;

/** Whitelist — nilai `?range=` sembarang tidak boleh membuat entri cache baru. */
export function parseExecRange(raw: string | string[] | undefined): ExecRange {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return EXEC_RANGES.find((r) => r === value) ?? DEFAULT_EXEC_RANGE;
}

export type FinKpi = {
  current: number;
  previous: number;
  deltaPct: number | null;
};

export type ExecFinanceData = {
  period: { year: number; month: number };
  hasData: boolean;
  revenue: FinKpi;
  expense: FinKpi;
  net: FinKpi;
  cashAndBank: number;
  cashInflow: number;
  cashOutflow: number;
  apOverdue: { count: number; total: number };
  arOverdue: { count: number; total: number };
  dueSoonCount: number;
  pendingSpend: { count: number; total: number };
  budgetOverruns: {
    label: string;
    limit: number;
    actual: number;
    usagePct: number;
  }[];
};

/**
 * DTO murni (number + string ISO): `unstable_cache` me-roundtrip hasil lewat
 * JSON, jadi Date/Decimal tidak boleh bocor ke sini.
 */
export type ExecCoreData = {
  kpi: {
    activeSkus: number;
    activeSuppliers: number;
    attentionCount: number;
    overdueTasks: number;
    incompleteTasks: number;
    readyLaunchProjects: number;
    avgMilestoneProgress: number;
  };
  approvals: { task: number; pipeline: number };
  critical: {
    id: string;
    name: string;
    sku: string;
    brandName: string;
    currentStock: number;
  }[];
  forecastPoSoon: {
    productId: string;
    name: string;
    brandName: string;
    currentStock: number;
    avgDailyDemand: number;
    status: "ORDER_NOW" | "ORDER_SOON";
    orderByDate: string | null;
  }[];
  milestones: { id: string; name: string; brandName: string; pct: number }[];
  team: {
    blocked: number;
    dueNext7Days: number;
    upcoming: {
      id: string;
      title: string;
      dueDate: string;
      contextLabel: string;
      assignees: string[];
    }[];
    attendance: {
      totalUsers: number;
      checkIn: number;
      sick: number;
      permission: number;
      absentEstimate: number;
    } | null;
  };
  finance: ExecFinanceData | null;
};

const num = (v: { toString(): string }) => Number(v.toString());

async function loadFinanceSnapshot(): Promise<ExecFinanceData | null> {
  try {
    // Bulan berjalan menurut kalender WIB, bukan zona waktu server.
    const [year, month] = getTodayDateString().split("-").map(Number);
    const period = { year: year!, month: month! };
    const [dash, pendingSpend, budget] = await Promise.all([
      loadFinanceDashboard(period),
      prisma.financeSpendRequest.aggregate({
        where: { status: FinanceSpendRequestStatus.SUBMITTED },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      aiGetBudgetVsActual("CEO", period),
    ]);

    const kpi = (k: {
      current: { toString(): string };
      previous: { toString(): string };
      deltaPct: number | null;
    }): FinKpi => ({
      current: num(k.current),
      previous: num(k.previous),
      deltaPct: k.deltaPct,
    });

    const budgetOverruns = budget.accessible
      ? budget.rows
          .filter((r) => r.overBudget && r.limitRaw > 0)
          .map((r) => ({
            label: r.label,
            limit: r.limitRaw,
            actual: r.actualRaw,
            usagePct: Math.round((r.actualRaw / r.limitRaw) * 100),
          }))
          .sort((a, b) => b.usagePct - a.usagePct)
          .slice(0, 3)
      : [];

    const data: ExecFinanceData = {
      period,
      hasData: false,
      revenue: kpi(dash.kpis.revenue),
      expense: kpi(dash.kpis.expense),
      net: kpi(dash.kpis.net),
      cashAndBank: num(dash.kpis.cashAndBank),
      cashInflow: num(dash.kpis.cash.inflow),
      cashOutflow: num(dash.kpis.cash.outflow),
      apOverdue: {
        count: dash.aging.apOverdueCount,
        total: num(dash.aging.apOverdueTotal),
      },
      arOverdue: {
        count: dash.aging.arOverdueCount,
        total: num(dash.aging.arOverdueTotal),
      },
      dueSoonCount: dash.alerts.dueSoonCount,
      pendingSpend: {
        count: pendingSpend._count._all,
        total: pendingSpend._sum.amount ? num(pendingSpend._sum.amount) : 0,
      },
      budgetOverruns,
    };
    data.hasData =
      data.revenue.current !== 0 ||
      data.expense.current !== 0 ||
      data.cashAndBank !== 0 ||
      num(dash.aging.apTotal) !== 0 ||
      num(dash.aging.arTotal) !== 0 ||
      data.pendingSpend.count > 0;
    return data;
  } catch (err) {
    // Modul finance tidak boleh menjatuhkan halaman CEO.
    console.error("[executive-dashboard] finance snapshot gagal", err);
    return null;
  }
}

async function loadExecCore(): Promise<ExecCoreData> {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dueSoonWhere = {
    archivedAt: null,
    status: { not: TaskStatus.DONE },
    dueDate: { gte: now, lte: in7Days },
  };

  const [
    products,
    milestoneProjects,
    activeSuppliers,
    overdueTasks,
    incompleteTasks,
    pendingTaskApprovals,
    pendingPipelineApprovals,
    blocked,
    dueNext7Days,
    upcomingTasks,
    attendance,
    finance,
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
    prisma.vendor.count(),
    prisma.task.count({
      where: { status: TaskStatus.OVERDUE, archivedAt: null },
    }),
    // Tugas aktif tanpa tenggat dan/atau tanpa PIC — bahan pengingat CEO.
    prisma.task.count({
      where: {
        archivedAt: null,
        status: { not: TaskStatus.DONE },
        OR: [{ dueDate: null }, { assignees: { none: {} } }],
      },
    }),
    prisma.task.count({
      where: { isApprovalRequired: true, isApproved: false },
    }),
    prisma.project.count({
      where: { pendingPipelineStage: { not: null }, brandId: { not: null } },
    }),
    prisma.task.count({
      where: { status: TaskStatus.BLOCKED, archivedAt: null },
    }),
    prisma.task.count({ where: dueSoonWhere }),
    prisma.task.findMany({
      where: dueSoonWhere,
      orderBy: { dueDate: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        dueDate: true,
        project: {
          select: {
            name: true,
            brand: { select: { name: true } },
            room: { select: { name: true } },
          },
        },
        assignees: { select: { user: { select: { name: true } } } },
      },
    }),
    aiGetAttendanceSummary("CEO").catch(() => null),
    loadFinanceSnapshot(),
  ]);

  const milestones = milestoneProjects.map((p) => ({
    id: p.id,
    name: p.name,
    brandName: p.brand?.name ?? "—",
    pct: computeMilestoneProgress(p.milestones),
  }));
  const avgMilestoneProgress =
    milestones.length > 0
      ? Math.round(
          milestones.reduce((acc, p) => acc + p.pct, 0) / milestones.length,
        )
      : 0;

  const forecasts = await computeReorderForecasts(
    products.map((p) => toForecastProductInput(p)),
    90,
  );
  const forecastPoSoon = forecasts
    .filter((f) => f.status === "ORDER_NOW" || f.status === "ORDER_SOON")
    .sort(
      (a, b) => (a.orderByDate?.getTime() ?? 0) - (b.orderByDate?.getTime() ?? 0),
    )
    .slice(0, 5)
    .map((f) => ({
      productId: f.productId,
      name: f.name,
      brandName: f.brandName,
      currentStock: f.currentStock,
      avgDailyDemand: f.avgDailyDemand,
      status: f.status as "ORDER_NOW" | "ORDER_SOON",
      orderByDate: f.orderByDate ? f.orderByDate.toISOString() : null,
    }));

  return {
    kpi: {
      activeSkus: products.length,
      activeSuppliers,
      attentionCount: products.filter(
        (p) => getStockHealth(p.currentStock, p.minStock) !== "OK",
      ).length,
      overdueTasks,
      incompleteTasks,
      readyLaunchProjects: milestones.filter((p) => p.pct >= 100).length,
      avgMilestoneProgress,
    },
    approvals: { task: pendingTaskApprovals, pipeline: pendingPipelineApprovals },
    critical: products
      .filter((p) => needsUrgentReorder(p.currentStock, p.minStock))
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        brandName: p.brand.name,
        currentStock: p.currentStock,
      })),
    forecastPoSoon,
    milestones,
    team: {
      blocked,
      dueNext7Days,
      upcoming: upcomingTasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate!.toISOString(),
        contextLabel: taskProjectContextLabel(t.project),
        assignees: t.assignees.map((a) => a.user.name?.trim() || "Tanpa nama"),
      })),
      attendance:
        attendance && attendance.accessible
          ? {
              totalUsers: attendance.summary.totalUsers,
              checkIn: attendance.summary.checkIn,
              sick: attendance.summary.sick,
              permission: attendance.summary.permission,
              absentEstimate: attendance.summary.absentEstimate,
            }
          : null,
    },
    finance,
  };
}

// Dua entri cache terpisah supaya ganti rentang tidak menghitung ulang data
// yang tak bergantung rentang. Mutasi stok meng-`updateTag` langsung; perubahan
// tugas/finance cukup mengikuti TTL 60 detik.
export const getExecCore = unstable_cache(loadExecCore, ["executive-core-v2"], {
  revalidate: 60,
  tags: [EXEC_DASHBOARD_TAG],
});

export const getExecOutgoing = unstable_cache(
  async (range: ExecRange): Promise<OutgoingAggregate> =>
    loadOutgoingAggregate(range),
  ["executive-outgoing-v2"],
  { revalidate: 60, tags: [EXEC_DASHBOARD_TAG] },
);

export type ExecInsight = {
  id: string;
  tone: "danger" | "warning" | "info";
  text: string;
  href: string;
};

/** Maks 4 hal paling mendesak, urut prioritas. Murni — dihitung di page. */
export function buildExecInsights(
  core: ExecCoreData,
  outgoing: OutgoingAggregate,
): ExecInsight[] {
  const out: ExecInsight[] = [];
  const fin = core.finance;

  if (core.critical.length > 0) {
    out.push({
      id: "critical-stock",
      tone: "danger",
      text: `${core.critical.length} SKU perlu reorder segera`,
      href: "/inventory",
    });
  }
  if (core.kpi.overdueTasks > 0) {
    out.push({
      id: "overdue",
      tone: "danger",
      text: `${core.kpi.overdueTasks} tugas melewati tenggat`,
      href: "/overdue",
    });
  }
  if (fin && fin.arOverdue.count > 0) {
    out.push({
      id: "ar-overdue",
      tone: "warning",
      text: `${fin.arOverdue.count} piutang jatuh tempo · ${formatIdrShort(fin.arOverdue.total)}`,
      href: "/finance/ap-ar",
    });
  }
  if (fin && fin.apOverdue.count > 0) {
    out.push({
      id: "ap-overdue",
      tone: "warning",
      text: `${fin.apOverdue.count} tagihan vendor jatuh tempo · ${formatIdrShort(fin.apOverdue.total)}`,
      href: "/finance/ap-ar",
    });
  }
  if (fin && fin.pendingSpend.count > 0) {
    out.push({
      id: "pending-spend",
      tone: "info",
      text: `${fin.pendingSpend.count} pengajuan dana menunggu · ${formatIdrShort(fin.pendingSpend.total)}`,
      href: "/finance/approvals",
    });
  }
  if (fin && fin.hasData && fin.net.current < 0) {
    out.push({
      id: "net-negative",
      tone: "warning",
      text: `Laba bersih bulan ini negatif (${formatIdrShort(fin.net.current)})`,
      href: "/finance",
    });
  }
  const loss = outgoing.totals.retur + outgoing.totals.rusak;
  if (outgoing.totalPcs > 0 && loss / outgoing.totalPcs > 0.05) {
    const pct = ((loss / outgoing.totalPcs) * 100).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    });
    out.push({
      id: "loss-rate",
      tone: "warning",
      text: `Retur + rusak ${pct}% dari barang keluar ${outgoing.windowDays} hari`,
      href: "/inventory",
    });
  }
  if (core.team.blocked > 0) {
    out.push({
      id: "blocked",
      tone: "info",
      text: `${core.team.blocked} tugas terblokir`,
      href: "/tasks",
    });
  }
  return out.slice(0, 4);
}

import {
  FinanceSpendRequestStatus,
  TaskStatus,
  type TaskPriority,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import { getStockHealth, type StockHealth } from "@/lib/stock-status";
import {
  computeReorderForecasts,
  forecastProductInclude,
  toForecastProductInput,
  type ReorderForecastStatus,
} from "@/lib/reorder-forecast";
import type { AiApiRole } from "./auth";
import {
  canViewApprovals,
  canViewFinancePending,
  canViewInventory,
  canViewTasks,
} from "./auth";

export type KpiOverview = {
  overdueTasks: number | null;
  criticalStockCount: number | null;
  lowStockCount: number | null;
  activeSkus: number | null;
  activeSuppliers: number | null;
  pendingTaskApprovals: number | null;
  pendingPipelineApprovals: number | null;
  pendingFinanceSpendApprovals: number | null;
};

export type OverdueTaskRow = {
  id: string;
  title: string;
  priority: TaskPriority;
  dueDate: string | null;
  status: TaskStatus;
  contextLabel: string;
  assignees: string[];
  daysOverdue: number | null;
};

export type InventoryAlertRow = {
  id: string;
  sku: string;
  name: string;
  brandName: string;
  currentStock: number;
  minStock: number;
  health: StockHealth;
  reorderStatus?: ReorderForecastStatus;
  reorderPoint?: number | null;
  avgDailyDemand?: number;
  daysUntilStockout?: number | null;
  orderByDate?: string | null;
  suggestedOrderQty?: number | null;
};

function daysOverdueFromDueDate(dueDate: Date | null): number | null {
  if (!dueDate) return null;
  const ms = Date.now() - dueDate.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export async function getKpiOverview(role: AiApiRole): Promise<KpiOverview> {
  const showTasks = canViewTasks(role);
  const showInventory = canViewInventory(role);
  const showApprovals = canViewApprovals(role);
  const showFinance = canViewFinancePending(role);

  const [
    overdueTasks,
    products,
    activeSuppliers,
    pendingTaskApprovals,
    pendingPipelineApprovals,
    pendingFinanceSpendApprovals,
  ] = await Promise.all([
    showTasks
      ? prisma.task.count({
          where: { status: TaskStatus.OVERDUE, archivedAt: null },
        })
      : Promise.resolve(null),
    showInventory
      ? prisma.product.findMany({
          select: { currentStock: true, minStock: true },
        })
      : Promise.resolve(null),
    showInventory ? prisma.vendor.count() : Promise.resolve(null),
    showApprovals
      ? prisma.task.count({
          where: { isApprovalRequired: true, isApproved: false },
        })
      : Promise.resolve(null),
    showApprovals
      ? prisma.project.count({
          where: { pendingPipelineStage: { not: null }, brandId: { not: null } },
        })
      : Promise.resolve(null),
    showFinance
      ? prisma.financeSpendRequest.count({
          where: { status: FinanceSpendRequestStatus.SUBMITTED },
        })
      : Promise.resolve(null),
  ]);

  let criticalStockCount: number | null = null;
  let lowStockCount: number | null = null;
  let activeSkus: number | null = null;

  if (products) {
    activeSkus = products.length;
    criticalStockCount = products.filter(
      (p) => getStockHealth(p.currentStock, p.minStock) === "CRITICAL",
    ).length;
    lowStockCount = products.filter(
      (p) => getStockHealth(p.currentStock, p.minStock) === "LOW",
    ).length;
  }

  return {
    overdueTasks,
    criticalStockCount,
    lowStockCount,
    activeSkus,
    activeSuppliers,
    pendingTaskApprovals,
    pendingPipelineApprovals,
    pendingFinanceSpendApprovals,
  };
}

export async function getOverdueTasks(
  role: AiApiRole,
  limit: number,
): Promise<OverdueTaskRow[]> {
  if (!canViewTasks(role)) return [];

  const rows = await prisma.task.findMany({
    where: { status: TaskStatus.OVERDUE, archivedAt: null },
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      status: true,
      project: {
        select: {
          name: true,
          brand: { select: { name: true } },
          room: { select: { name: true } },
        },
      },
      assignees: {
        select: { user: { select: { name: true, email: true } } },
      },
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    take: limit,
  });

  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString() ?? null,
    status: t.status,
    contextLabel: taskProjectContextLabel(t.project),
    assignees: t.assignees.map(
      (a) => a.user.name?.trim() || a.user.email || "—",
    ),
    daysOverdue: daysOverdueFromDueDate(t.dueDate),
  }));
}

export async function getInventoryAlerts(
  role: AiApiRole,
  severity: "all" | "critical" | "low",
  limit: number,
): Promise<InventoryAlertRow[]> {
  if (!canViewInventory(role)) return [];

  const products = await prisma.product.findMany({
    include: {
      brand: { select: { name: true } },
      ...forecastProductInclude,
    },
    orderBy: [{ currentStock: "asc" }, { name: "asc" }],
  });

  const forecasts = await computeReorderForecasts(
    products.map((p) => toForecastProductInput(p)),
    90,
  );
  const forecastById = new Map(forecasts.map((f) => [f.productId, f]));

  const alerts = products
    .map((p) => {
      const fc = forecastById.get(p.id);
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        brandName: p.brand.name,
        currentStock: p.currentStock,
        minStock: p.minStock,
        health: getStockHealth(p.currentStock, p.minStock),
        reorderStatus: fc?.status,
        reorderPoint: fc?.reorderPoint ?? null,
        avgDailyDemand: fc?.avgDailyDemand,
        daysUntilStockout: fc?.daysUntilStockout ?? null,
        orderByDate: fc?.orderByDate?.toISOString() ?? null,
        suggestedOrderQty: fc?.suggestedOrderQty ?? null,
      };
    })
    .filter((p) => {
      const forecastUrgent =
        p.reorderStatus === "ORDER_NOW" || p.reorderStatus === "ORDER_SOON";
      const stockAlert = p.health !== "OK";
      if (severity === "critical") {
        return p.health === "CRITICAL" || p.reorderStatus === "ORDER_NOW";
      }
      if (severity === "low") {
        return p.health === "LOW" || p.reorderStatus === "ORDER_SOON";
      }
      return stockAlert || forecastUrgent;
    })
    .sort((a, b) => {
      const rank = (s?: ReorderForecastStatus) => {
        if (s === "ORDER_NOW") return 0;
        if (s === "ORDER_SOON") return 1;
        return 2;
      };
      const dr = rank(a.reorderStatus) - rank(b.reorderStatus);
      if (dr !== 0) return dr;
      return a.currentStock - b.currentStock;
    })
    .slice(0, limit);

  return alerts;
}

import { StockLogType } from "@prisma/client";
import type {
  ProductReorderForecast,
  ReorderForecastStatus,
} from "@/lib/reorder-forecast";
import { getStockHealth, type StockHealth } from "@/lib/stock-status";
import { isSystemStockLog } from "@/lib/stock-log-utils";

export type ProductStockRow = {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  minStock: number;
  brand: { id: string; name: string };
  category: string | null;
  preferredVendor?: { id: string; name: string } | null;
};

export type StockLogRow = {
  id: string;
  productId: string;
  amount: number;
  type: StockLogType;
  salesCategory: string | null;
  note: string | null;
  reference: string | null;
  createdAt: Date;
  product: ProductStockRow;
};

export type InventoryDashboardStats = {
  totalSkus: number;
  totalUnits: number;
  criticalCount: number;
  lowCount: number;
  okCount: number;
  todayIn: number;
  todayOut: number;
  weekIn: number;
  weekOut: number;
  reorderList: Array<{
    id: string;
    name: string;
    sku: string;
    brandName: string;
    currentStock: number;
    minStock: number;
    health: StockHealth;
    gap: number;
    reorderStatus?: ReorderForecastStatus;
    reorderPoint?: number | null;
    orderByDate?: Date | null;
  }>;
};

function forecastStatusRank(status?: ReorderForecastStatus): number {
  if (status === "ORDER_NOW") return 0;
  if (status === "ORDER_SOON") return 1;
  return 2;
}

function mergeForecastIntoReorderList(
  base: InventoryDashboardStats["reorderList"],
  forecasts: ProductReorderForecast[],
): InventoryDashboardStats["reorderList"] {
  const byId = new Map(base.map((item) => [item.id, item]));

  for (const f of forecasts) {
    if (f.status !== "ORDER_NOW" && f.status !== "ORDER_SOON") continue;

    const existing = byId.get(f.productId);
    const minStock = f.reorderPoint ?? f.manualMinStock;
    const health =
      existing?.health ?? getStockHealth(f.currentStock, f.manualMinStock);

    byId.set(f.productId, {
      id: f.productId,
      name: f.name,
      sku: f.sku,
      brandName: f.brandName,
      currentStock: f.currentStock,
      minStock,
      health,
      gap: Math.max(0, minStock - f.currentStock),
      reorderStatus: f.status,
      reorderPoint: f.reorderPoint,
      orderByDate: f.orderByDate,
    });
  }

  return Array.from(byId.values()).sort((a, b) => {
    const sr = forecastStatusRank(a.reorderStatus) - forecastStatusRank(b.reorderStatus);
    if (sr !== 0) return sr;
    if (a.health === "CRITICAL" && b.health !== "CRITICAL") return -1;
    if (b.health === "CRITICAL" && a.health !== "CRITICAL") return 1;
    return b.gap - a.gap;
  });
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number): Date {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - n);
  return d;
}

export function computeInventoryDashboard(
  products: ProductStockRow[],
  logs: StockLogRow[],
  forecasts?: ProductReorderForecast[],
): InventoryDashboardStats {
  const todayStart = startOfDay(new Date());
  const weekStart = daysAgo(7);

  let criticalCount = 0;
  let lowCount = 0;
  let okCount = 0;
  let totalUnits = 0;

  const reorderList: InventoryDashboardStats["reorderList"] = [];

  for (const p of products) {
    totalUnits += p.currentStock;
    const health = getStockHealth(p.currentStock, p.minStock);
    if (health === "CRITICAL") criticalCount++;
    else if (health === "LOW") lowCount++;
    else okCount++;

    if (health !== "OK") {
      reorderList.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        brandName: p.brand.name,
        currentStock: p.currentStock,
        minStock: p.minStock,
        health,
        gap: Math.max(0, p.minStock - p.currentStock),
      });
    }
  }

  reorderList.sort((a, b) => {
    if (a.health === "CRITICAL" && b.health !== "CRITICAL") return -1;
    if (b.health === "CRITICAL" && a.health !== "CRITICAL") return 1;
    return b.gap - a.gap;
  });

  let todayIn = 0;
  let todayOut = 0;
  let weekIn = 0;
  let weekOut = 0;

  for (const log of logs) {
    if (isSystemStockLog(log.note)) continue;
    const t = new Date(log.createdAt);
    const isToday = t >= todayStart;
    const isWeek = t >= weekStart;
    if (log.type === StockLogType.IN) {
      if (isToday) todayIn += log.amount;
      if (isWeek) weekIn += log.amount;
    } else {
      if (isToday) todayOut += log.amount;
      if (isWeek) weekOut += log.amount;
    }
  }

  return {
    totalSkus: products.length,
    totalUnits,
    criticalCount,
    lowCount,
    okCount,
    todayIn,
    todayOut,
    weekIn,
    weekOut,
    reorderList: forecasts?.length
      ? mergeForecastIntoReorderList(reorderList, forecasts)
      : reorderList,
  };
}

import { StockLogType } from "@prisma/client";
import type { ProductVendorRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  formatProductVendorsSummary,
  resolveChainLeadTime,
  resolveProductVendorLinks,
  type ProductVendorChainInput,
} from "@/lib/product-vendor";
import { isSystemStockLog, resolveEffectiveOutLogs } from "@/lib/stock-log-utils";

export type ReorderForecastStatus =
  | "ORDER_NOW"
  | "ORDER_SOON"
  | "OK"
  | "NO_DATA"
  | "NO_LEAD_TIME";

export type ProductVendorForecastLink = {
  vendorId: string;
  vendorName: string;
  role: ProductVendorRole;
  roleLabel: string | null;
  leadTimeDays: number | null;
};

export type ProductReorderForecast = {
  productId: string;
  sku: string;
  name: string;
  brandName: string;
  currentStock: number;
  manualMinStock: number;
  windowDays: number;
  totalSales: number;
  avgDailyDemand: number;
  leadTimeDays: number | null;
  safetyStockDays: number | null;
  reviewPeriodDays: number | null;
  safetyStockUnits: number;
  reorderPoint: number | null;
  daysUntilStockout: number | null;
  orderByDate: Date | null;
  suggestedOrderQty: number | null;
  status: ReorderForecastStatus;
  /** Vendor bottleneck (lead time terpanjang dalam rantai). */
  preferredVendor: {
    id: string;
    name: string;
    leadTimeDays: number | null;
  } | null;
  productVendors: ProductVendorForecastLink[];
  vendorsSummary: string;
};

export type ForecastProductInput = ProductVendorChainInput & {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
  minStock: number;
  brand: { name: string };
};

type SalesLogRow = {
  id: string;
  productId: string;
  amount: number;
  type: StockLogType;
  salesCategory: string | null;
  note: string | null;
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeProductReorderForecast(
  product: ForecastProductInput,
  salesByProductId: Map<string, number>,
  windowDays: number,
): ProductReorderForecast {
  const totalSales = salesByProductId.get(product.id) ?? 0;
  const avgDailyDemand = windowDays > 0 ? totalSales / windowDays : 0;

  const vendorLinks = resolveProductVendorLinks(product);
  const chain = resolveChainLeadTime(product, vendorLinks);
  const { leadTimeDays, safetyStockDays, reviewPeriodDays } = chain;

  const productVendors: ProductVendorForecastLink[] = vendorLinks.map((l) => ({
    vendorId: l.vendorId,
    vendorName: l.vendorName,
    role: l.role,
    roleLabel: l.roleLabel,
    leadTimeDays: l.leadTimeDays,
  }));

  const preferredVendor =
    chain.bottleneckVendorId && chain.bottleneckVendorName
      ? {
          id: chain.bottleneckVendorId,
          name: chain.bottleneckVendorName,
          leadTimeDays,
        }
      : product.preferredVendor
        ? {
            id: product.preferredVendor.id,
            name: product.preferredVendor.name,
            leadTimeDays: product.preferredVendor.leadTimeDays,
          }
        : null;

  const base: ProductReorderForecast = {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    brandName: product.brand.name,
    currentStock: product.currentStock,
    manualMinStock: product.minStock,
    windowDays,
    totalSales,
    avgDailyDemand,
    leadTimeDays,
    safetyStockDays,
    reviewPeriodDays,
    safetyStockUnits: 0,
    reorderPoint: null,
    daysUntilStockout: null,
    orderByDate: null,
    suggestedOrderQty: null,
    status: "NO_DATA",
    preferredVendor,
    productVendors,
    vendorsSummary: formatProductVendorsSummary(vendorLinks),
  };

  if (avgDailyDemand <= 0) {
    return { ...base, status: "NO_DATA" };
  }

  if (chain.missingLeadTime || leadTimeDays == null || leadTimeDays < 0) {
    return { ...base, status: "NO_LEAD_TIME" };
  }

  const safetyStockUnits = Math.ceil(avgDailyDemand * safetyStockDays);
  const reorderPoint = Math.ceil(avgDailyDemand * leadTimeDays + safetyStockUnits);
  const daysUntilStockout =
    product.currentStock <= 0 ? 0 : product.currentStock / avgDailyDemand;

  const orderByOffset = Math.max(0, daysUntilStockout - leadTimeDays);
  const orderByDate = addDays(startOfToday(), Math.floor(orderByOffset));

  const targetStock = Math.ceil(
    avgDailyDemand * (leadTimeDays + reviewPeriodDays),
  );
  const suggestedOrderQty = Math.max(0, targetStock - product.currentStock);

  let status: ReorderForecastStatus = "OK";
  const today = startOfToday();
  const soonThreshold = addDays(today, 7);

  if (
    product.currentStock <= reorderPoint ||
    product.currentStock <= 0 ||
    orderByDate <= today
  ) {
    status = "ORDER_NOW";
  } else if (orderByDate <= soonThreshold) {
    status = "ORDER_SOON";
  }

  return {
    ...base,
    safetyStockUnits,
    reorderPoint,
    daysUntilStockout,
    orderByDate,
    suggestedOrderQty,
    status,
  };
}

export async function loadSalesTotalsByProduct(
  productIds: string[],
  windowDays: number,
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const logs = await prisma.stockLog.findMany({
    where: {
      productId: { in: productIds },
      type: StockLogType.OUT,
      createdAt: { gte: since },
    },
    select: {
      id: true,
      productId: true,
      amount: true,
      type: true,
      salesCategory: true,
      note: true,
    },
  });

  const byProduct = new Map<string, SalesLogRow[]>();
  for (const log of logs) {
    const list = byProduct.get(log.productId) ?? [];
    list.push(log);
    byProduct.set(log.productId, list);
  }

  const totals = new Map<string, number>();
  for (const [productId, productLogs] of byProduct) {
    const effective = resolveEffectiveOutLogs(productLogs).filter(
      (row) => row.salesCategory === "penjualan" && !isSystemStockLog(row.note),
    );
    totals.set(
      productId,
      effective.reduce((sum, row) => sum + row.amount, 0),
    );
  }

  return totals;
}

export async function computeReorderForecasts(
  products: ForecastProductInput[],
  windowDays = 90,
): Promise<ProductReorderForecast[]> {
  const productIds = products.map((p) => p.id);
  const salesByProductId = await loadSalesTotalsByProduct(productIds, windowDays);

  return products
    .map((p) => computeProductReorderForecast(p, salesByProductId, windowDays))
    .sort((a, b) => {
      const rank = (s: ReorderForecastStatus) => {
        if (s === "ORDER_NOW") return 0;
        if (s === "ORDER_SOON") return 1;
        if (s === "NO_LEAD_TIME") return 2;
        if (s === "NO_DATA") return 3;
        return 4;
      };
      const dr = rank(a.status) - rank(b.status);
      if (dr !== 0) return dr;
      const aDays = a.daysUntilStockout ?? 9999;
      const bDays = b.daysUntilStockout ?? 9999;
      return aDays - bDays;
    });
}

export function reorderStatusLabel(status: ReorderForecastStatus): string {
  switch (status) {
    case "ORDER_NOW":
      return "Pesan sekarang";
    case "ORDER_SOON":
      return "Pesan minggu ini";
    case "OK":
      return "Aman";
    case "NO_LEAD_TIME":
      return "Set lead time vendor";
    case "NO_DATA":
      return "Belum ada data penjualan";
    default:
      return status;
  }
}

/** Shape Prisma include untuk forecast product input. */
export const forecastProductInclude = {
  preferredVendor: {
    select: {
      id: true,
      name: true,
      leadTimeDays: true,
      safetyStockDays: true,
      reviewPeriodDays: true,
    },
  },
  productVendors: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          leadTimeDays: true,
          safetyStockDays: true,
          reviewPeriodDays: true,
        },
      },
    },
  },
};

export function toForecastProductInput(
  product: {
    id: string;
    sku: string;
    name: string;
    currentStock: number;
    minStock: number;
    leadTimeDaysOverride: number | null;
    safetyStockDaysOverride: number | null;
    brand: { name: string };
    preferredVendor: {
      id: string;
      name: string;
      leadTimeDays: number | null;
      safetyStockDays: number;
      reviewPeriodDays: number;
    } | null;
    productVendors: Array<{
      role: ProductVendorRole;
      roleLabel: string | null;
      leadTimeDaysOverride: number | null;
      sortOrder: number;
      vendor: {
        id: string;
        name: string;
        leadTimeDays: number | null;
        safetyStockDays: number;
        reviewPeriodDays: number;
      };
    }>;
  },
): ForecastProductInput {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    currentStock: product.currentStock,
    minStock: product.minStock,
    leadTimeDaysOverride: product.leadTimeDaysOverride,
    safetyStockDaysOverride: product.safetyStockDaysOverride,
    brand: product.brand,
    preferredVendor: product.preferredVendor,
    productVendors: product.productVendors.map((pv) => ({
      role: pv.role,
      roleLabel: pv.roleLabel,
      leadTimeDaysOverride: pv.leadTimeDaysOverride,
      sortOrder: pv.sortOrder,
      vendor: pv.vendor,
    })),
  };
}

import { StockLogType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  loadBrandProjectsWithMilestones,
  summarizeProjectMilestones,
} from "@/lib/ai-api/pipeline-milestones";
import { getStockHealth, needsUrgentReorder } from "@/lib/stock-status";
import {
  aggregateOutgoing,
  type CategoryPcs,
  type OutgoingAggregate,
} from "@/lib/outgoing-metrics";

export type OutgoingByBrandRow = {
  brandName: string;
  totalPcs: number;
  /** Penjualan murni (tidak lagi memuat retur/rusak/tanpa kategori). */
  salesPcs: number;
  samplingPcs: number;
  returPcs: number;
  rusakPcs: number;
  otherPcs: number;
};

/**
 * Satu query StockLog OUT + agregasi per kategori. Memuat 2 × `days` agar
 * delta terhadap periode sebelumnya bisa dihitung tanpa query kedua.
 */
export async function loadOutgoingAggregate(
  days = 90,
): Promise<OutgoingAggregate> {
  const now = new Date();
  const since = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000);
  const logs = await prisma.stockLog.findMany({
    where: { type: StockLogType.OUT, createdAt: { gte: since } },
    select: {
      id: true,
      amount: true,
      type: true,
      salesCategory: true,
      note: true,
      createdAt: true,
      productId: true,
      product: {
        select: { name: true, sku: true, brand: { select: { name: true } } },
      },
    },
  });
  return aggregateOutgoing(logs, {
    windowDays: days,
    now,
    includesPreviousWindow: true,
  });
}

/** Outgoing PCS per brand per kategori, dengan koreksi [SYS]. */
export async function computeOutgoingByBrand(days = 90): Promise<{
  windowDays: number;
  totals: CategoryPcs;
  categoryNote: string;
  brands: OutgoingByBrandRow[];
}> {
  const agg = await loadOutgoingAggregate(days);
  return {
    windowDays: agg.windowDays,
    totals: agg.totals,
    categoryNote:
      "salesPcs = penjualan murni; retur, rusak/expired, dan log tanpa kategori (otherPcs) dipisah.",
    brands: agg.brands.map((b) => ({
      brandName: b.brandName,
      totalPcs: b.totalPcs,
      salesPcs: b.byCategory.penjualan,
      samplingPcs: b.byCategory.sampling,
      returPcs: b.byCategory.retur,
      rusakPcs: b.byCategory.rusak,
      otherPcs: b.byCategory.other,
    })),
  };
}

export async function computePipelineMilestoneSnapshot(limit = 12) {
  const projects = await loadBrandProjectsWithMilestones();

  const rows = projects.map((p) => {
    const summary = summarizeProjectMilestones(p.milestones);
    return {
      id: p.id,
      name: p.name,
      brandName: p.brand?.name ?? "—",
      roomName: p.room.name,
      progressPct: summary.progressPct,
      topLevelDone: summary.topLevelDone,
      topLevelTotal: summary.topLevelTotal,
      blockedCount: summary.blockedCount,
      currentMilestone: summary.currentMilestone,
    };
  });

  const avgProgress =
    rows.length > 0
      ? Math.round(
          rows.reduce((s, r) => s + r.progressPct, 0) / rows.length,
        )
      : 0;

  return {
    projectCount: rows.length,
    avgMilestoneProgressPct: avgProgress,
    completedCount: rows.filter((r) => r.progressPct >= 100).length,
    needsAttentionCount: rows.filter((r) => r.progressPct < 50).length,
    withBlockedMilestones: rows.filter((r) => r.blockedCount > 0).length,
    readyForLaunchCount: rows.filter((r) => r.progressPct >= 100).length,
    projects: rows
      .slice()
      .sort((a, b) => b.progressPct - a.progressPct)
      .slice(0, limit),
  };
}

export async function computeCriticalStockSkus(limit = 10) {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      sku: true,
      name: true,
      currentStock: true,
      minStock: true,
      brand: { select: { name: true } },
    },
    orderBy: { currentStock: "asc" },
  });

  const critical = products
    .filter((p) => needsUrgentReorder(p.currentStock, p.minStock))
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      brandName: p.brand.name,
      currentStock: p.currentStock,
      minStock: p.minStock,
      health: getStockHealth(p.currentStock, p.minStock),
    }));

  return {
    criticalCount: products.filter((p) =>
      needsUrgentReorder(p.currentStock, p.minStock),
    ).length,
    lowCount: products.filter(
      (p) => getStockHealth(p.currentStock, p.minStock) === "LOW",
    ).length,
    items: critical,
  };
}

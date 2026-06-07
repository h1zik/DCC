import { StockLogType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  loadBrandProjectsWithMilestones,
  summarizeProjectMilestones,
} from "@/lib/ai-api/pipeline-milestones";
import { getStockHealth, needsUrgentReorder } from "@/lib/stock-status";

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

export type OutgoingByBrandRow = {
  brandName: string;
  totalPcs: number;
  salesPcs: number;
  samplingPcs: number;
};

/** Outgoing PCS per brand (sales + sampling) dengan koreksi [SYS]. */
export async function computeOutgoingByBrand(days = 90): Promise<{
  windowDays: number;
  brands: OutgoingByBrandRow[];
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const salesLogs = await prisma.stockLog.findMany({
    where: { type: StockLogType.OUT, createdAt: { gte: since } },
    select: {
      id: true,
      amount: true,
      type: true,
      salesCategory: true,
      note: true,
      product: { select: { brand: { select: { name: true } } } },
    },
  });

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

  const brands = Object.entries(pcsByBrand)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([brandName, v]) => ({
      brandName,
      totalPcs: v.total,
      salesPcs: v.sales,
      samplingPcs: v.sampling,
    }));

  return { windowDays: days, brands };
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

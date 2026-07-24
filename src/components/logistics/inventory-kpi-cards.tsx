"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
} from "lucide-react";
import type { InventoryDashboardStats } from "@/lib/inventory-metrics";
import { ExecutiveKpiCard } from "@/app/(dashboard)/executive-kpi-card";

export function InventoryKpiCards({ stats }: { stats: InventoryDashboardStats }) {
  const attentionCount = stats.criticalCount + stats.lowCount;
  const healthyPct =
    stats.totalSkus > 0
      ? Math.round(((stats.totalSkus - attentionCount) / stats.totalSkus) * 100)
      : 100;
  const attentionTone =
    stats.criticalCount > 0 ? "danger" : stats.lowCount > 0 ? "warning" : "success";

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ExecutiveKpiCard
        label="Total SKU aktif"
        value={stats.totalSkus}
        description={`${stats.totalUnits.toLocaleString("id-ID")} unit di gudang`}
        icon={<Package className="size-4" />}
        tone="neutral"
      />
      <ExecutiveKpiCard
        label="Perlu perhatian"
        value={attentionCount}
        description={`${stats.criticalCount} kritis · ${stats.lowCount} menipis`}
        icon={<AlertTriangle className="size-4" />}
        tone={attentionTone}
        indicator={healthyPct}
        href={attentionCount > 0 ? "/inventory?tab=stok&status=attention" : undefined}
        ctaLabel={attentionCount > 0 ? "Lihat daftar" : undefined}
      />
      <ExecutiveKpiCard
        label="Masuk hari ini"
        value={stats.todayIn}
        description={`${stats.weekIn.toLocaleString("id-ID")} unit minggu ini`}
        icon={<ArrowDownToLine className="size-4" />}
        tone="success"
      />
      <ExecutiveKpiCard
        label="Keluar hari ini"
        value={stats.todayOut}
        description={`${stats.weekOut.toLocaleString("id-ID")} unit minggu ini`}
        icon={<ArrowUpFromLine className="size-4" />}
        tone="accent"
      />
    </div>
  );
}

"use client";

import {
  formatCompactCount,
  formatRevenueIdr,
  formatSoldThreshold,
} from "@/lib/research/shop-product-metrics";
import type { CompetitorShopMetrics } from "@/lib/research/competitor-shop-metrics";
import { hub } from "@/components/research-hub/research-hub-primitives";

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className={hub.nestedPanel}>
      <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-foreground mt-0.5 text-lg font-semibold tabular-nums">
        {value}
      </p>
      {sub ? (
        <p className="text-muted-foreground mt-0.5 text-[10px]">{sub}</p>
      ) : null}
    </div>
  );
}

export function CompetitorShopMetricsPanel({
  metrics,
  skuCount,
}: {
  metrics: CompetitorShopMetrics;
  skuCount: number;
}) {
  const hasAny =
    metrics.totalHistoricalSold != null ||
    metrics.totalMonthlySold != null ||
    metrics.totalEstimatedRevenue != null ||
    metrics.totalStock != null;

  if (!hasAny) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada data penjualan toko — refresh kompetitor untuk mengambil historis
        terjual, stok, dan estimasi revenue per SKU.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <KpiCard
        label="Total terjual"
        value={formatSoldThreshold(metrics.totalHistoricalSold)}
        sub={
          metrics.skusWithSold > 0
            ? `dari ${metrics.skusWithSold} SKU`
            : undefined
        }
      />
      <KpiCard
        label="Terjual bulan ini"
        value={formatSoldThreshold(metrics.totalMonthlySold)}
        sub={
          metrics.skusWithMonthlySold > 0
            ? `${metrics.skusWithMonthlySold} SKU melaporkan`
            : undefined
        }
      />
      <KpiCard
        label="Est. revenue"
        value={formatRevenueIdr(metrics.totalEstimatedRevenue)}
        sub={
          metrics.skusWithRevenue > 0
            ? `agregat ${metrics.skusWithRevenue} SKU`
            : undefined
        }
      />
      <KpiCard
        label="Total stok"
        value={formatCompactCount(metrics.totalStock)}
        sub={
          metrics.skusWithStock > 0
            ? `dari ${metrics.skusWithStock} SKU · ${skuCount} total`
            : `${skuCount} SKU`
        }
      />
    </div>
  );
}

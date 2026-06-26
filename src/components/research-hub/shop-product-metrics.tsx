"use client";

import Link from "next/link";
import type { ShopProductMetrics } from "@/lib/research/shop-product-metrics";
import {
  formatCompactCount,
  formatRevenueIdr,
  formatSoldThreshold,
  resolveShopProductMetrics,
} from "@/lib/research/shop-product-metrics";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

export type ShopProductCardMetrics = ShopProductMetrics & {
  price?: number | null;
  currentPrice?: number | null;
  rating?: number | null;
  reviewCount?: number;
};

export function ShopProductMetricsStrip({
  metrics,
  compact = false,
  showStock = true,
  hidden = false,
  className,
}: {
  metrics: ShopProductCardMetrics;
  compact?: boolean;
  showStock?: boolean;
  hidden?: boolean;
  className?: string;
}) {
  const m = resolveShopProductMetrics({
    ...metrics,
    price: metrics.price ?? metrics.currentPrice ?? null,
  });

  if (hidden) return null;

  const cells = [
    {
      label: "Total terjual",
      value: formatSoldThreshold(m.historicalSold),
      highlight: true,
    },
    ...(m.monthlySold != null
      ? [{ label: "Bulan ini", value: formatSoldThreshold(m.monthlySold) }]
      : []),
    {
      label: "Est. revenue",
      value: formatRevenueIdr(m.estimatedRevenue),
    },
    ...(showStock
      ? [{ label: "Stok", value: formatCompactCount(m.stock) }]
      : []),
  ];

  if (compact) {
    return (
      <div className={cn("flex flex-wrap gap-1.5", className)}>
        {m.historicalSold != null ? (
          <span className="bg-primary/10 text-primary rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
            {formatSoldThreshold(m.historicalSold)} terjual
          </span>
        ) : null}
        {m.monthlySold != null ? (
          <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
            {formatSoldThreshold(m.monthlySold)}/bln
          </span>
        ) : null}
        {m.estimatedRevenue != null ? (
          <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
            {formatRevenueIdr(m.estimatedRevenue)}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-2",
        cells.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : `grid-cols-${cells.length}`,
        className,
      )}
    >
      {cells.map((c) => (
        <div key={c.label} className={hub.nestedPanel}>
          <p className="text-muted-foreground text-[10px]">{c.label}</p>
          <p
            className={cn(
              "mt-0.5 text-xs font-semibold tabular-nums",
              c.highlight && "text-primary",
            )}
          >
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ShopProductDetailLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "hover:text-primary line-clamp-2 text-sm leading-snug font-medium transition-colors",
        className,
      )}
    >
      {children}
    </Link>
  );
}

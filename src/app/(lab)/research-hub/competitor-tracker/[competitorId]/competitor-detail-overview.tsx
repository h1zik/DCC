"use client";

import { useMemo } from "react";
import type { CompetitorSkuRow } from "@/components/research-hub/competitor-sku-table";
import type { CompetitorInsights } from "@/lib/research/competitor-insights";
import type { CompetitorShopMetrics } from "@/lib/research/competitor-shop-metrics";
import {
  formatCompactCount,
  formatRevenueIdr,
  formatSoldThreshold,
} from "@/lib/research/shop-product-metrics";
import { cn } from "@/lib/utils";
import { FactList, type Fact } from "../_components/detail-section";

/**
 * Ringkasan angka toko di atas tab: jumlah SKU sebagai angka utama, metrik
 * penjualan sebagai daftar definisi, lalu distribusi pergerakan harga.
 */
export function CompetitorDetailOverview({
  skus,
  shopMetrics,
  insights,
  promoSkuCount,
  discountDepthPct,
  shareOfCategoryPct,
  unreadAlerts,
}: {
  skus: CompetitorSkuRow[];
  shopMetrics: CompetitorShopMetrics;
  insights: CompetitorInsights;
  promoSkuCount: number;
  discountDepthPct: number | null;
  shareOfCategoryPct: number | null;
  unreadAlerts: number;
}) {
  const facts: Fact[] = [
    {
      label: "Total terjual",
      value: formatSoldThreshold(shopMetrics.totalHistoricalSold),
      hint: shopMetrics.skusWithSold > 0 ? `dari ${shopMetrics.skusWithSold} SKU` : undefined,
    },
    {
      label: "Terjual bulan ini",
      value: formatSoldThreshold(shopMetrics.totalMonthlySold),
      hint:
        shopMetrics.skusWithMonthlySold > 0
          ? `${shopMetrics.skusWithMonthlySold} SKU melaporkan`
          : undefined,
    },
    {
      label: "Estimasi omzet",
      value: formatRevenueIdr(shopMetrics.totalEstimatedRevenue),
      hint: shopMetrics.skusWithRevenue > 0 ? `dari ${shopMetrics.skusWithRevenue} SKU` : undefined,
    },
    {
      label: "Total stok",
      value: shopMetrics.totalStock != null ? formatCompactCount(shopMetrics.totalStock) : "—",
      hint: shopMetrics.skusWithStock > 0 ? `dari ${shopMetrics.skusWithStock} SKU` : undefined,
    },
    {
      label: "SKU promo",
      value: promoSkuCount.toLocaleString("id-ID"),
      hint:
        discountDepthPct != null
          ? `${insights.promoPct}% SKU, diskon sekitar ${discountDepthPct.toFixed(0)}%`
          : insights.skuCount > 0
            ? `${insights.promoPct}% dari SKU`
            : undefined,
    },
    {
      label: "Alert belum dibaca",
      value: unreadAlerts.toLocaleString("id-ID"),
      hint:
        shareOfCategoryPct != null
          ? `Pangsa kategori ${shareOfCategoryPct.toFixed(1)}%`
          : undefined,
    },
  ];

  return (
    <section
      aria-label="Ringkasan toko"
      className="border-border flex flex-col gap-6 border-y py-5"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(12rem,auto)_1fr] lg:gap-10">
        <div className="flex flex-col gap-1">
          <p className="rh-meta">SKU dipantau</p>
          <p className="rh-num text-foreground text-[2rem] leading-none font-semibold tracking-tight">
            {skus.length.toLocaleString("id-ID")}
          </p>
          <p className="rh-meta max-w-[24ch]">
            Sekitar 100 SKU teratas sesuai urutan listing marketplace.
          </p>
        </div>
        <FactList facts={facts} className="sm:grid-cols-3 xl:grid-cols-3" />
      </div>
      {skus.length > 0 ? <PriceMovement skus={skus} /> : null}
    </section>
  );
}

const MOVE_SEGMENTS = [
  { key: "up", label: "Harga naik", bar: "bg-rose-500" },
  { key: "down", label: "Harga turun", bar: "bg-emerald-500" },
  { key: "flat", label: "Stabil atau belum ada tren", bar: "bg-muted-foreground/25" },
] as const;

/** Distribusi arah harga SKU dibanding snapshot sebelumnya. */
function PriceMovement({ skus }: { skus: CompetitorSkuRow[] }) {
  const move = useMemo(() => {
    let up = 0;
    let down = 0;
    for (const s of skus) {
      if (s.priceDirection === "up") up += 1;
      else if (s.priceDirection === "down") down += 1;
    }
    return { up, down, flat: skus.length - up - down };
  }, [skus]);

  const total = skus.length || 1;
  const summary = MOVE_SEGMENTS.map((s) => `${s.label} ${move[s.key]}`).join(", ");

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-foreground text-sm font-medium">Pergerakan harga</p>
        <p className="rh-meta">Dibanding snapshot sebelumnya</p>
      </div>
      <div className="bg-muted flex h-2 overflow-hidden rounded-full" role="img" aria-label={summary}>
        {MOVE_SEGMENTS.map((s) =>
          move[s.key] > 0 ? (
            <span
              key={s.key}
              className={s.bar}
              style={{ width: `${(move[s.key] / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        {MOVE_SEGMENTS.map((s) => (
          <li key={s.key} className="rh-meta flex items-center gap-1.5">
            <span className={cn("size-2 shrink-0 rounded-full", s.bar)} aria-hidden />
            <span>{s.label}</span>
            <span className="rh-num text-foreground font-medium">{move[s.key]}</span>
            <span className="rh-num">({Math.round((move[s.key] / total) * 100)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

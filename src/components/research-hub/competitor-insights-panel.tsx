"use client";

import { formatRp, formatRelativeTime } from "@/lib/research/labels";
import type { CompetitorInsights } from "@/lib/research/competitor-insights";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

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

export function CompetitorInsightsPanel({
  insights,
  bare = false,
}: {
  insights: CompetitorInsights;
  bare?: boolean;
}) {
  const content = (
    <>
      {insights.lastSyncedAt ? (
        <p className="text-muted-foreground mb-3 text-xs">
          Terakhir sync {formatRelativeTime(new Date(insights.lastSyncedAt))}
        </p>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="SKU" value={String(insights.skuCount)} />
        <KpiCard
          label="Harga rata-rata"
          value={insights.avgPrice != null ? formatRp(insights.avgPrice) : "—"}
        />
        <KpiCard
          label="Rating rata-rata"
          value={
            insights.avgRating != null ? insights.avgRating.toFixed(2) : "—"
          }
        />
        <KpiCard
          label="Total review"
          value={insights.totalReviews.toLocaleString("id-ID")}
        />
        <KpiCard
          label="SKU promo"
          value={`${insights.promoCount}`}
          sub={
            insights.skuCount > 0 ? `${insights.promoPct}% portfolio` : undefined
          }
        />
        <KpiCard
          label="Rentang harga"
          value={
            insights.minPrice != null && insights.maxPrice != null
              ? `${Math.round(insights.minPrice / 1000)}–${Math.round(insights.maxPrice / 1000)}rb`
              : "—"
          }
        />
      </div>

      <div
        className={cn(
          hub.nestedPanel,
          insights.promoPct >= 50
            ? "border-amber-500/30 bg-amber-500/10"
            : "border-primary/20 bg-primary/5",
        )}
      >
        <p className="text-foreground text-sm font-medium">{insights.headline}</p>
        <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed">
          {insights.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
    </>
  );

  if (bare) {
    return <div className={hub.panel}>{content}</div>;
  }

  return (
    <section className={cn(hub.panel)}>
      <h2 className="text-foreground mb-3 text-sm font-semibold">
        Ringkasan & Kesimpulan
      </h2>
      {content}
    </section>
  );
}

import type { ResearchMarketplace } from "@prisma/client";
import { MarketplaceLogo } from "@/components/research-hub/marketplace-logo";
import { MARKETPLACE_LABELS, formatRp } from "@/lib/research/labels";
import { cn } from "@/lib/utils";
import type { DiscoveryInsights } from "./discovery-types";

/** Warna segmen distribusi marketplace (kategori, di-cycle berurutan). */
const MP_DOTS = [
  "bg-violet-500",
  "bg-teal-500",
  "bg-amber-400",
  "bg-rose-400",
  "bg-sky-500",
  "bg-emerald-500",
] as const;

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="rh-meta">{label}</dt>
      <dd className="rh-num text-foreground text-lg font-semibold">{value}</dd>
      {note ? <dd className="rh-meta rh-num">{note}</dd> : null}
    </div>
  );
}

/**
 * Ringkasan angka hasil pencarian: definition list tenang + distribusi
 * marketplace sebagai satu bar bertumpuk dengan legenda.
 */
export function DiscoveryMetrics({
  productCount,
  productLimit,
  shopCount,
  insights,
  marketplaceSummary,
}: {
  productCount: number;
  productLimit: number;
  shopCount: number;
  insights: DiscoveryInsights | null;
  marketplaceSummary: { mp: ResearchMarketplace; count: number }[];
}) {
  const priceStats = insights?.priceStats ?? null;
  const promoSharePct =
    typeof insights?.promoShare === "number"
      ? Math.round(
          insights.promoShare <= 1
            ? insights.promoShare * 100
            : insights.promoShare,
        )
      : null;
  const total = marketplaceSummary.reduce((sum, m) => sum + m.count, 0);
  const distTotal = total || 1;

  return (
    <section aria-label="Ringkasan hasil" className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        <Metric
          label="Produk ditemukan"
          value={productCount.toLocaleString("id-ID")}
          note={`Target ${productLimit.toLocaleString("id-ID")} produk`}
        />
        <Metric label="Brand atau toko" value={shopCount.toLocaleString("id-ID")} />
        <Metric
          label="Harga median"
          value={priceStats ? formatRp(Math.round(priceStats.median)) : "—"}
          note={
            priceStats
              ? `${formatRp(Math.round(priceStats.min))} sampai ${formatRp(Math.round(priceStats.max))}`
              : undefined
          }
        />
        <Metric
          label="Harga rata-rata"
          value={priceStats ? formatRp(Math.round(priceStats.avg)) : "—"}
        />
        <Metric
          label="Produk berpromo"
          value={promoSharePct != null ? `${promoSharePct}%` : "—"}
        />
      </dl>

      {total > 0 ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-foreground text-sm font-medium">
              Distribusi marketplace
            </h2>
            <span className="rh-meta rh-num">
              {total.toLocaleString("id-ID")} produk
            </span>
          </div>
          <div className="bg-muted flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {marketplaceSummary.map(({ mp, count }, index) =>
              count === 0 ? null : (
                <div
                  key={mp}
                  className={MP_DOTS[index % MP_DOTS.length]}
                  style={{ width: `${(count / distTotal) * 100}%` }}
                />
              ),
            )}
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-1.5">
            {marketplaceSummary.map(({ mp, count }, index) => (
              <li key={mp} className="flex items-center gap-2 text-sm">
                <span
                  className={cn("rh-dot", MP_DOTS[index % MP_DOTS.length])}
                  aria-hidden
                />
                <MarketplaceLogo marketplace={mp} className="size-3.5" />
                <span className="text-muted-foreground">{MARKETPLACE_LABELS[mp]}</span>
                <span className="rh-num font-medium">{count}</span>
                <span className="rh-meta rh-num">
                  ({Math.round((count / distTotal) * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

import { ResearchBackLink } from "@/components/research-hub/kit/research-locator";
import {
  ShopProductDetailPanel,
  type ShopProductDetailData,
} from "@/components/research-hub/shop-product-detail-panel";
import { SkuSoldHistoryChart } from "@/components/research-hub/sku-sold-history-chart";
import { CompetitorPriceChart } from "@/components/research-hub/competitor-price-chart";
import type { SoldHistoryPoint } from "@/lib/research/shop-product-mappers";
import { formatRp } from "@/lib/research/labels";
import {
  formatCompactCount,
  formatRevenueIdr,
  formatSoldThreshold,
} from "@/lib/research/shop-product-metrics";

export type TrackedProductMetrics = {
  currentPrice: number | null;
  hasPromo: boolean;
  promoText: string | null;
  rating: number | null;
  reviewCount: number;
  historicalSold: number | null;
  monthlySold: number | null;
  estimatedRevenue: number | null;
  stock: number | null;
};

/**
 * Halaman detail produk yang dipantau (SKU toko kompetitor & produk
 * kompetitor per kategori). Harga jadi angka utama; metrik lain satu baris
 * definisi; grafik riwayat di bawah. Satu sumber untuk kedua rute.
 */
export function TrackedProductDetail({
  product,
  metrics,
  soldHistory,
  backHref,
  backLabel,
}: {
  product: ShopProductDetailData;
  metrics: TrackedProductMetrics;
  soldHistory: SoldHistoryPoint[];
  backHref: string;
  backLabel: string;
}) {
  const priceHistory = soldHistory.map((p) => ({ date: p.date, Harga: p.price }));
  const hasPriceHistory = priceHistory.some((p) => p.Harga != null);

  const facts: { label: string; value: string; hint?: string }[] = [
    {
      label: "Rating",
      value: metrics.rating != null ? `${metrics.rating.toFixed(1)} / 5` : "—",
      hint: `${metrics.reviewCount.toLocaleString("id-ID")} review`,
    },
    { label: "Total terjual", value: formatSoldThreshold(metrics.historicalSold) },
    {
      label: "Terjual bulan ini",
      value: metrics.monthlySold != null ? formatCompactCount(metrics.monthlySold) : "—",
    },
    { label: "Estimasi omzet", value: formatRevenueIdr(metrics.estimatedRevenue) },
    { label: "Stok", value: metrics.stock != null ? formatCompactCount(metrics.stock) : "—" },
  ];

  return (
    <div className="flex w-full flex-col gap-8 pb-12">
      <ShopProductDetailPanel
        product={product}
        breadcrumbs={<ResearchBackLink href={backHref} label={backLabel} className="self-start" />}
      />

      <section
        aria-label="Metrik produk"
        className="border-border grid gap-6 border-y py-5 lg:grid-cols-[minmax(14rem,auto)_1fr] lg:gap-10"
      >
        <div className="flex flex-col gap-1">
          <p className="rh-meta">Harga saat ini</p>
          <p className="rh-num text-foreground text-[2rem] leading-none font-semibold tracking-tight">
            {metrics.currentPrice != null ? formatRp(metrics.currentPrice) : "—"}
          </p>
          <p className="rh-meta">
            {metrics.hasPromo
              ? (metrics.promoText ?? "Sedang promo")
              : "Dari snapshot terakhir marketplace"}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-5">
          {facts.map((f) => (
            <div key={f.label} className="flex flex-col gap-0.5">
              <dt className="rh-meta">{f.label}</dt>
              <dd className="rh-num text-foreground text-lg font-semibold tracking-tight">{f.value}</dd>
              {f.hint ? <dd className="rh-meta rh-num">{f.hint}</dd> : null}
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="sold-history-title" className="flex flex-col gap-3">
        <div>
          <h2 id="sold-history-title" className="rh-section-title">
            Riwayat penjualan
          </h2>
          <p className="rh-meta">
            Satu titik per refresh: total terjual, terjual bulanan, dan estimasi omzet.
          </p>
        </div>
        <SkuSoldHistoryChart data={soldHistory} />
      </section>

      {hasPriceHistory ? (
        <section aria-labelledby="price-history-title" className="flex flex-col gap-3">
          <div>
            <h2 id="price-history-title" className="rh-section-title">
              Riwayat harga
            </h2>
            <p className="rh-meta">Pergerakan harga dari setiap snapshot.</p>
          </div>
          <CompetitorPriceChart
            data={priceHistory}
            skuNames={["Harga"]}
            hasTrend={priceHistory.length >= 2}
          />
        </section>
      ) : null}
    </div>
  );
}

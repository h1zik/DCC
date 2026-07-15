import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { lab, LabPageShell } from "@/components/lab/lab-primitives";
import {
  ShopProductDetailPanel,
  type ShopProductDetailData,
} from "@/components/research-hub/shop-product-detail-panel";
import { SkuSoldHistoryChart } from "@/components/research-hub/sku-sold-history-chart";
import { CompetitorPriceChart } from "@/components/research-hub/competitor-price-chart";
import {
  buildSkuSoldHistory,
  mapCompetitorSkuFields,
} from "@/lib/research/shop-product-mappers";
import { backfillCompetitorSkuMetricsFromSnapshots } from "@/lib/research/backfill-sku-metrics";
import { formatRp } from "@/lib/research/labels";
import {
  formatCompactCount,
  formatRevenueIdr,
  formatSoldThreshold,
} from "@/lib/research/shop-product-metrics";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function CompetitorSkuDetailPage({
  params,
}: {
  params: Promise<{ competitorId: string; skuId: string }>;
}) {
  const { competitorId, skuId } = await params;

  const sku = await prisma.competitorSku.findFirst({
    where: { id: skuId, competitorId },
    include: {
      competitor: { select: { name: true, marketplace: true } },
      snapshots: { orderBy: { capturedAt: "asc" } },
    },
  });
  if (!sku) notFound();

  await backfillCompetitorSkuMetricsFromSnapshots(competitorId);

  const freshSku = await prisma.competitorSku.findFirst({
    where: { id: skuId, competitorId },
    include: {
      competitor: { select: { name: true, marketplace: true } },
      snapshots: { orderBy: { capturedAt: "asc" } },
    },
  });
  if (!freshSku) notFound();

  const latestPromo = [...freshSku.snapshots].reverse().find((s) => s.hasPromo);

  const latestSnapshot = freshSku.snapshots.at(-1) ?? null;
  const metrics = mapCompetitorSkuFields(freshSku, latestSnapshot);

  const product: ShopProductDetailData = {
    id: freshSku.id,
    name: freshSku.name,
    productUrl: freshSku.productUrl,
    imageUrl: freshSku.imageUrl,
    marketplace: freshSku.competitor.marketplace,
    shopName: freshSku.competitor.name,
    price: freshSku.currentPrice,
    rating: freshSku.rating,
    reviewCount: freshSku.reviewCount,
    soldCount: metrics.historicalSold ?? metrics.exactSold,
    hasPromo: latestPromo?.hasPromo ?? false,
    promoText: latestPromo?.promoText ?? null,
    categoryRank: latestSnapshot?.categoryRank ?? null,
    shopLocation: metrics.shopLocation ?? null,
    isOfficialShop: metrics.isOfficialShop ?? false,
    ...metrics,
  };

  const soldHistory = buildSkuSoldHistory(freshSku.snapshots);
  const priceHistory = soldHistory.map((p) => ({
    date: p.date,
    Harga: p.price,
  }));

  return (
    <LabPageShell>
      <div className="flex flex-col gap-6">
        <ShopProductDetailPanel
          product={product}
          breadcrumbs={
            <Button
              size="sm"
              variant="ghost"
              className="w-fit gap-1 px-0"
              render={
                <Link href={`/research-hub/competitor-tracker/${competitorId}`} />
              }
            >
              <ChevronLeft className="size-4" />
              Kembali ke {freshSku.competitor.name}
            </Button>
          }
        />

        {/* Papan hero bento metrik SKU */}
        <div
          className={cn(
            lab.entrance,
            "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4",
          )}
        >
          <div className="bento-tile col-span-2 row-span-2 border-transparent bg-violet-600 shadow-md shadow-violet-600/20 lg:col-span-1 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Harga saat ini
            </span>
            <span className="bento-value text-4xl text-white dark:text-violet-950">
              {freshSku.currentPrice != null
                ? formatRp(freshSku.currentPrice)
                : "—"}
            </span>
            <span className="text-[11px] font-medium leading-snug text-violet-100/90 dark:text-violet-900/80">
              {product.hasPromo
                ? (product.promoText ?? "Sedang promo")
                : "snapshot terakhir dari marketplace"}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Rating</span>
            <span className="bento-value">
              {freshSku.rating != null ? freshSku.rating.toFixed(1) : "—"}
              {freshSku.rating != null ? (
                <span className="text-muted-foreground/60 text-lg font-bold">
                  /5
                </span>
              ) : null}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Review</span>
            <span className="bento-value">
              {freshSku.reviewCount.toLocaleString("id-ID")}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Total terjual</span>
            <span className="bento-value">
              {formatSoldThreshold(metrics.historicalSold)}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Terjual bulan ini</span>
            <span className="bento-value">
              {metrics.monthlySold != null
                ? formatCompactCount(metrics.monthlySold)
                : "—"}
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
              Est. revenue
            </span>
            <span className="bento-value text-2xl text-violet-900 dark:text-violet-300">
              {formatRevenueIdr(metrics.estimatedRevenue)}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Stok</span>
            <span className="bento-value">
              {metrics.stock != null ? formatCompactCount(metrics.stock) : "—"}
            </span>
          </div>
        </div>

        <div className={cn(lab.entrance, "bento-tile justify-start gap-3")}>
          <div className="flex items-center justify-between">
            <span className="bento-label">Riwayat penjualan</span>
            <span className="text-muted-foreground text-[11px]">
              snapshot per refresh — total terjual, bulanan, estimasi revenue
            </span>
          </div>
          <SkuSoldHistoryChart data={soldHistory} />
        </div>

        {priceHistory.some((p) => p.Harga != null) ? (
          <div className={cn(lab.entrance, "bento-tile justify-start gap-3")}>
            <div className="flex items-center justify-between">
              <span className="bento-label">Riwayat harga</span>
              <span className="text-muted-foreground text-[11px]">
                pergerakan harga dari snapshot
              </span>
            </div>
            <CompetitorPriceChart
              data={priceHistory}
              skuNames={["Harga"]}
              hasTrend={priceHistory.length >= 2}
            />
          </div>
        ) : null}
      </div>
    </LabPageShell>
  );
}

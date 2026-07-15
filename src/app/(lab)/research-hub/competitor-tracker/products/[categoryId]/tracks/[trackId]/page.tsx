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
import { buildSkuSoldHistory } from "@/lib/research/shop-product-mappers";
import {
  parseShopProductAttributes,
  parseShopProductModels,
  parseShopProductRatingDistribution,
  parseShopProductVariations,
} from "@/lib/research/shop-product-detail-parse";
import { formatRp } from "@/lib/research/labels";
import {
  formatCompactCount,
  formatRevenueIdr,
  formatSoldThreshold,
} from "@/lib/research/shop-product-metrics";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function CompetitorProductTrackDetailPage({
  params,
}: {
  params: Promise<{ categoryId: string; trackId: string }>;
}) {
  const { categoryId, trackId } = await params;

  const track = await prisma.competitorProductTrack.findFirst({
    where: { id: trackId, categoryId },
    include: {
      category: { select: { name: true } },
      snapshots: { orderBy: { capturedAt: "asc" } },
    },
  });
  if (!track) notFound();

  const product: ShopProductDetailData = {
    id: track.id,
    name: track.name,
    productUrl: track.productUrl,
    imageUrl: track.imageUrl,
    imageUrls: track.imageUrls,
    marketplace: track.marketplace,
    shopName: track.shopName,
    shopLocation: null,
    isOfficialShop: false,
    price: track.currentPrice,
    rating: track.rating,
    reviewCount: track.reviewCount,
    soldCount: track.historicalSold ?? track.exactSold,
    hasPromo: track.hasPromo,
    promoText: track.promoText,
    categoryRank: null,
    exactSold: track.exactSold,
    historicalSold: track.historicalSold,
    monthlySold: track.monthlySold,
    estimatedRevenue: track.estimatedRevenue,
    stock: track.stock,
    brand: track.brand,
    categoryName: track.categoryName,
    categoryPath: track.categoryPath,
    description: track.description,
    attributes: parseShopProductAttributes(track.attributes),
    variations: parseShopProductVariations(track.variations),
    models: parseShopProductModels(track.models),
    ratingDistribution: parseShopProductRatingDistribution(track.ratingDistribution),
  };

  const soldHistory = buildSkuSoldHistory(
    track.snapshots.map((s) => ({
      capturedAt: s.capturedAt,
      price: s.price,
      exactSold: s.exactSold,
      historicalSold: s.historicalSold,
      monthlySold: s.monthlySold,
      estimatedRevenue: s.estimatedRevenue,
      stock: s.stock,
    })),
  );

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
                <Link
                  href={`/research-hub/competitor-tracker/products/${categoryId}`}
                />
              }
            >
              <ChevronLeft className="size-4" />
              Kembali ke {track.category.name}
            </Button>
          }
        />

        {/* Papan hero bento metrik produk */}
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
              {track.currentPrice != null ? formatRp(track.currentPrice) : "—"}
            </span>
            <span className="text-[11px] font-medium leading-snug text-violet-100/90 dark:text-violet-900/80">
              {track.hasPromo
                ? (track.promoText ?? "Sedang promo")
                : "snapshot terakhir dari marketplace"}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Rating</span>
            <span className="bento-value">
              {track.rating != null ? track.rating.toFixed(1) : "—"}
              {track.rating != null ? (
                <span className="text-muted-foreground/60 text-lg font-bold">
                  /5
                </span>
              ) : null}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Review</span>
            <span className="bento-value">
              {track.reviewCount.toLocaleString("id-ID")}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Total terjual</span>
            <span className="bento-value">
              {formatSoldThreshold(track.historicalSold)}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Terjual bulan ini</span>
            <span className="bento-value">
              {track.monthlySold != null
                ? formatCompactCount(track.monthlySold)
                : "—"}
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
              Est. revenue
            </span>
            <span className="bento-value text-2xl text-violet-900 dark:text-violet-300">
              {formatRevenueIdr(track.estimatedRevenue)}
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Stok</span>
            <span className="bento-value">
              {track.stock != null ? formatCompactCount(track.stock) : "—"}
            </span>
          </div>
        </div>

        {soldHistory.length > 0 ? (
          <div className={cn(lab.entrance, "bento-tile justify-start gap-3")}>
            <div className="flex items-center justify-between">
              <span className="bento-label">Riwayat penjualan</span>
              <span className="text-muted-foreground text-[11px]">
                snapshot per refresh — total terjual dan estimasi revenue
              </span>
            </div>
            <SkuSoldHistoryChart data={soldHistory} />
          </div>
        ) : null}

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

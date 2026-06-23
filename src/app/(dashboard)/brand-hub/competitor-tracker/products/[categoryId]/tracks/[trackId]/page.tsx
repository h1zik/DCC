import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { BrandHubSection, hub } from "@/components/brand-hub/brand-hub-primitives";
import {
  ShopProductDetailPanel,
  type ShopProductDetailData,
} from "@/components/research-hub/shop-product-detail-panel";
import { SkuSoldHistoryChart } from "@/components/research-hub/sku-sold-history-chart";
import { CompetitorPriceChart } from "@/components/research-hub/competitor-price-chart";
import { buildSkuSoldHistory } from "@/lib/research/shop-product-mappers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ensureBrandHubPage } from "../../../../../layout";

export default async function BrandCompetitorProductTrackDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string; trackId: string }>;
  searchParams: Promise<{ brandId?: string }>;
}) {
  await ensureBrandHubPage();
  const { categoryId, trackId } = await params;
  const { brandId } = await searchParams;

  const track = await prisma.competitorProductTrack.findFirst({
    where: { id: trackId, categoryId },
    include: {
      category: { select: { name: true } },
      snapshots: { orderBy: { capturedAt: "asc" } },
    },
  });
  if (!track) notFound();

  const backHref = brandId
    ? `/brand-hub/competitor-tracker/products/${categoryId}?brandId=${encodeURIComponent(brandId)}`
    : `/brand-hub/competitor-tracker/products/${categoryId}`;

  const product: ShopProductDetailData = {
    id: track.id,
    name: track.name,
    productUrl: track.productUrl,
    imageUrl: track.imageUrl,
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
    <div className="flex flex-col gap-8">
      <ShopProductDetailPanel
        product={product}
        breadcrumbs={
          <Button
            size="sm"
            variant="ghost"
            className="w-fit gap-1 px-0"
            render={<Link href={backHref} />}
          >
            <ChevronLeft className="size-4" />
            Kembali ke {track.category.name}
          </Button>
        }
      />

      {soldHistory.length > 0 ? (
        <BrandHubSection
          title="Riwayat Penjualan"
          description="Snapshot per refresh — total terjual dan estimasi revenue."
        >
          <div className={cn(hub.panel)}>
            <SkuSoldHistoryChart data={soldHistory} />
          </div>
        </BrandHubSection>
      ) : null}

      {priceHistory.some((p) => p.Harga != null) ? (
        <BrandHubSection title="Riwayat Harga" description="Pergerakan harga dari snapshot.">
          <div className={cn(hub.panel)}>
            <CompetitorPriceChart
              data={priceHistory}
              skuNames={["Harga"]}
              hasTrend={priceHistory.length >= 2}
            />
          </div>
        </BrandHubSection>
      ) : null}
    </div>
  );
}

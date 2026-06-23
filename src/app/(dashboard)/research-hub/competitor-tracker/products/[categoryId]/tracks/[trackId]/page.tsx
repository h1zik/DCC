import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ResearchHubPageShell, ResearchHubSection } from "@/components/research-hub/research-hub-primitives";
import {
  ShopProductDetailPanel,
  type ShopProductDetailData,
} from "@/components/research-hub/shop-product-detail-panel";
import { SkuSoldHistoryChart } from "@/components/research-hub/sku-sold-history-chart";
import { CompetitorPriceChart } from "@/components/research-hub/competitor-price-chart";
import { buildSkuSoldHistory } from "@/lib/research/shop-product-mappers";
import { hub } from "@/components/research-hub/research-hub-primitives";
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

  const latestSnapshot = track.snapshots.at(-1) ?? null;

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
    <ResearchHubPageShell>
      <div className="flex flex-col gap-8">
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

        {soldHistory.length > 0 ? (
          <ResearchHubSection
            title="Riwayat Penjualan"
            description="Snapshot per refresh — total terjual dan estimasi revenue."
          >
            <div className={cn(hub.panel)}>
              <SkuSoldHistoryChart data={soldHistory} />
            </div>
          </ResearchHubSection>
        ) : null}

        {priceHistory.some((p) => p.Harga != null) ? (
          <ResearchHubSection title="Riwayat Harga" description="Pergerakan harga dari snapshot.">
            <div className={cn(hub.panel)}>
              <CompetitorPriceChart
                data={priceHistory}
                skuNames={["Harga"]}
                hasTrend={priceHistory.length >= 2}
              />
            </div>
          </ResearchHubSection>
        ) : null}
      </div>
    </ResearchHubPageShell>
  );
}

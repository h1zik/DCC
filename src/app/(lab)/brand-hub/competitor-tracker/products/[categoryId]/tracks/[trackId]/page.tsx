import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { LabSection, lab } from "@/components/lab/lab-primitives";
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
    // Detail kaya dari scraper VPS shopee-product (disimpan tapi sebelumnya tidak ditampilkan).
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
        <LabSection
          title="Riwayat Penjualan"
          description="Snapshot per refresh — total terjual dan estimasi revenue."
        >
          <div className={cn(lab.panel)}>
            <SkuSoldHistoryChart data={soldHistory} />
          </div>
        </LabSection>
      ) : null}

      {priceHistory.some((p) => p.Harga != null) ? (
        <LabSection title="Riwayat Harga" description="Pergerakan harga dari snapshot.">
          <div className={cn(lab.panel)}>
            <CompetitorPriceChart
              data={priceHistory}
              skuNames={["Harga"]}
              hasTrend={priceHistory.length >= 2}
            />
          </div>
        </LabSection>
      ) : null}
    </div>
  );
}

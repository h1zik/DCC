import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TrackedProductDetail } from "@/components/research-hub/kit/tracked-product-detail";
import {
  ShopProductDetailPanel,
  type ShopProductDetailData,
} from "@/components/research-hub/shop-product-detail-panel";
import { buildSkuSoldHistory } from "@/lib/research/shop-product-mappers";
import {
  parseShopProductAttributes,
  parseShopProductModels,
  parseShopProductRatingDistribution,
  parseShopProductVariations,
} from "@/lib/research/shop-product-detail-parse";

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

  return (
    <TrackedProductDetail
      product={product}
      soldHistory={soldHistory}
      backHref={`/research-hub/competitor-tracker/products/${categoryId}`}
      backLabel={track.category.name}
      metrics={{
        currentPrice: track.currentPrice,
        hasPromo: track.hasPromo,
        promoText: track.promoText,
        rating: track.rating,
        reviewCount: track.reviewCount,
        historicalSold: track.historicalSold,
        monthlySold: track.monthlySold,
        estimatedRevenue: track.estimatedRevenue,
        stock: track.stock,
      }}
    />
  );
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TrackedProductDetail } from "@/components/research-hub/kit/tracked-product-detail";
import {
  type ShopProductDetailData,
} from "@/components/research-hub/shop-product-detail-panel";
import {
  buildSkuSoldHistory,
  mapCompetitorSkuFields,
} from "@/lib/research/shop-product-mappers";
import { backfillCompetitorSkuMetricsFromSnapshots } from "@/lib/research/backfill-sku-metrics";

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

  return (
    <TrackedProductDetail
      product={product}
      soldHistory={soldHistory}
      backHref={`/research-hub/competitor-tracker/${competitorId}`}
      backLabel={freshSku.competitor.name}
      metrics={{
        currentPrice: freshSku.currentPrice,
        hasPromo: product.hasPromo,
        promoText: product.promoText,
        rating: freshSku.rating,
        reviewCount: freshSku.reviewCount,
        historicalSold: metrics.historicalSold ?? null,
        monthlySold: metrics.monthlySold ?? null,
        estimatedRevenue: metrics.estimatedRevenue ?? null,
        stock: metrics.stock ?? null,
      }}
    />
  );
}

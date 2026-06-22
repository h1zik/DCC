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
import {
  buildSkuSoldHistory,
  mapCompetitorSkuFields,
} from "@/lib/research/shop-product-mappers";
import { backfillCompetitorSkuMetricsFromSnapshots } from "@/lib/research/backfill-sku-metrics";
import { hub } from "@/components/research-hub/research-hub-primitives";
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
                <Link href={`/research-hub/competitor-tracker/${competitorId}`} />
              }
            >
              <ChevronLeft className="size-4" />
              Kembali ke {freshSku.competitor.name}
            </Button>
          }
        />

        <ResearchHubSection
          title="Riwayat Penjualan"
          description="Snapshot per refresh kompetitor — total terjual, bulanan (Shopee), dan estimasi revenue."
        >
          <div className={cn(hub.panel)}>
            <SkuSoldHistoryChart data={soldHistory} />
          </div>
        </ResearchHubSection>

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

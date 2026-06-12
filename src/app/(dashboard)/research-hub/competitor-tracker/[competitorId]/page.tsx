import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resumeStuckResearchJobs } from "@/lib/research/run-apify-job";
import {
  buildCurrentPriceBarData,
  buildPriceChartData,
  buildShareOfReviewData,
  isNewSku,
} from "@/lib/research/competitor-charts";
import {
  buildCompetitorInsights,
  buildSkuPriceChanges,
} from "@/lib/research/competitor-insights";
import {
  CompetitorDetailClient,
  type CompetitorDetail,
} from "./competitor-detail-client";

type Props = { params: Promise<{ competitorId: string }> };

export default async function CompetitorDetailPage({ params }: Props) {
  const { competitorId } = await params;

  await resumeStuckResearchJobs();

  const competitor = await prisma.researchCompetitor.findUnique({
    where: { id: competitorId },
    include: {
      skus: { orderBy: { reviewCount: "desc" } },
      snapshots: {
        orderBy: { capturedAt: "asc" },
        include: { sku: { select: { name: true } } },
      },
      alerts: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });

  if (!competitor) notFound();

  const latestPromoBySku = new Map<string, { hasPromo: boolean; promoText: string | null }>();
  for (const snap of [...competitor.snapshots].reverse()) {
    if (snap.skuId && !latestPromoBySku.has(snap.skuId)) {
      latestPromoBySku.set(snap.skuId, {
        hasPromo: snap.hasPromo,
        promoText: snap.promoText,
      });
    }
  }

  const skus = competitor.skus.map((s) => {
    const promo = latestPromoBySku.get(s.id);
    return {
      id: s.id,
      name: s.name,
      productUrl: s.productUrl,
      currentPrice: s.currentPrice,
      rating: s.rating,
      reviewCount: s.reviewCount,
      isNew: isNewSku(s.firstSeenAt),
      hasPromo: promo?.hasPromo ?? false,
      promoText: promo?.promoText ?? null,
    };
  });

  const priceChanges = buildSkuPriceChanges(
    competitor.snapshots.map((s) => ({
      skuId: s.skuId,
      price: s.price,
      capturedAt: s.capturedAt,
    })),
    competitor.skus.map((s) => s.id),
  );

  const skusWithDelta = skus.map((s) => {
    const change = priceChanges.get(s.id);
    return {
      ...s,
      priceDeltaPct: change?.deltaPct ?? null,
      priceDirection: change?.direction ?? null,
    };
  });

  const insights = buildCompetitorInsights(
    skus,
    competitor.snapshots.map((s) => ({
      skuId: s.skuId,
      price: s.price,
      capturedAt: s.capturedAt,
    })),
  );

  const snapshotRows = competitor.snapshots.map((s) => ({
    capturedAt: s.capturedAt,
    skuId: s.skuId,
    price: s.price,
    rating: s.rating,
    reviewCount: s.reviewCount,
    sku: s.sku,
  }));

  const priceChart30 = buildPriceChartData(snapshotRows, competitor.skus, 30);

  const detail: CompetitorDetail = {
    id: competitor.id,
    name: competitor.name,
    brand: competitor.brand,
    category: competitor.category,
    marketplace: competitor.marketplace,
    shopUrl: competitor.shopUrl,
    skus: skusWithDelta,
    insights,
    currentPriceBar: buildCurrentPriceBarData(
      competitor.skus.map((s) => ({
        ...s,
        hasPromo: latestPromoBySku.get(s.id)?.hasPromo ?? false,
      })),
    ),
    alerts: competitor.alerts.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      severity: a.severity,
      isRead: a.isRead,
      createdAt: a.createdAt.toISOString(),
    })),
    priceChart30,
    priceChart60: buildPriceChartData(snapshotRows, competitor.skus, 60),
    priceChart90: buildPriceChartData(snapshotRows, competitor.skus, 90),
    shareOfReview: buildShareOfReviewData(competitor.skus),
  };

  return (
    <div className="pb-6">
      <CompetitorDetailClient competitor={detail} />
    </div>
  );
}

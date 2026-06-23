import "server-only";

import { prisma } from "@/lib/prisma";
import { MARKETPLACE_LABELS } from "@/lib/research/labels";

export type CompetitorProductTrackSummary = {
  id: string;
  name: string;
  brand: string | null;
  price: number | null;
  rating: number | null;
  sold: number | null;
  marketplace: string;
  hasPromo: boolean;
  promoText: string | null;
};

export type CompetitorProductEvidence = {
  sourceId: string;
  categoryName: string;
  trackCount: number;
  priceStats: { min: number; max: number; avg: number } | null;
  promoSharePct: number | null;
  topTracks: CompetitorProductTrackSummary[];
  marketplaceBreakdown: { marketplace: string; count: number }[];
};

function computePriceStats(
  prices: number[],
): { min: number; max: number; avg: number } | null {
  if (prices.length === 0) return null;
  const sum = prices.reduce((a, b) => a + b, 0);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: Math.round(sum / prices.length),
  };
}

function soldCount(track: {
  exactSold: number | null;
  monthlySold: number | null;
  historicalSold: number | null;
}): number | null {
  if (typeof track.exactSold === "number") return track.exactSold;
  if (typeof track.monthlySold === "number") return track.monthlySold;
  if (typeof track.historicalSold === "number") return track.historicalSold;
  return null;
}

export async function fetchCompetitorProductEvidence(
  categoryIds: string[],
): Promise<CompetitorProductEvidence[]> {
  if (categoryIds.length === 0) return [];

  const categories = await prisma.competitorProductCategory.findMany({
    where: {
      id: { in: categoryIds },
      isActive: true,
    },
    take: 10,
    include: {
      tracks: {
        where: { isActive: true },
        orderBy: [{ reviewCount: "desc" }, { lastScrapedAt: "desc" }],
        take: 50,
      },
    },
  });

  return categories.map((cat) => {
    const tracks = cat.tracks;
    const prices = tracks
      .map((t) => t.currentPrice)
      .filter((p): p is number => typeof p === "number" && p > 0);
    const promoCount = tracks.filter((t) => t.hasPromo).length;

    const marketplaceMap = new Map<string, number>();
    for (const t of tracks) {
      const label = MARKETPLACE_LABELS[t.marketplace] ?? t.marketplace;
      marketplaceMap.set(label, (marketplaceMap.get(label) ?? 0) + 1);
    }

    const topTracks = tracks.slice(0, 10).map(
      (t): CompetitorProductTrackSummary => ({
        id: t.id,
        name: t.name,
        brand: t.brand,
        price: t.currentPrice,
        rating: t.rating,
        sold: soldCount(t),
        marketplace: MARKETPLACE_LABELS[t.marketplace] ?? t.marketplace,
        hasPromo: t.hasPromo,
        promoText: t.promoText,
      }),
    );

    return {
      sourceId: cat.id,
      categoryName: cat.name,
      trackCount: tracks.length,
      priceStats: computePriceStats(prices),
      promoSharePct:
        tracks.length > 0
          ? Math.round((promoCount / tracks.length) * 100)
          : null,
      topTracks,
      marketplaceBreakdown: [...marketplaceMap.entries()]
        .map(([marketplace, count]) => ({ marketplace, count }))
        .sort((a, b) => b.count - a.count),
    };
  });
}

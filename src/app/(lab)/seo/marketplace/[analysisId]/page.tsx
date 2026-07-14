import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  MarketplaceDetailClient,
  type MarketplaceDetail,
} from "./marketplace-detail-client";

export default async function SeoMarketplaceDetailPage({
  params,
}: {
  params: Promise<{ analysisId: string }>;
}) {
  const { analysisId } = await params;

  const analysis = await prisma.seoMarketplaceAnalysis.findUnique({
    where: { id: analysisId },
  });
  if (!analysis) notFound();

  const detail: MarketplaceDetail = {
    id: analysis.id,
    keyword: analysis.keyword,
    marketplace: analysis.marketplace,
    ownTitle: analysis.ownTitle,
    status: analysis.status,
    optimizationScore: analysis.optimizationScore,
    listingStats: (analysis.listingStats as Record<string, unknown> | null) ?? null,
    titlePatterns:
      (analysis.titlePatterns as MarketplaceDetail["titlePatterns"]) ?? [],
    topListings: (analysis.topListings as MarketplaceDetail["topListings"]) ?? [],
    recommendations:
      (analysis.recommendations as MarketplaceDetail["recommendations"]) ?? null,
    dataNotice: analysis.dataNotice,
    errorMessage: analysis.errorMessage,
  };

  return <MarketplaceDetailClient analysis={detail} />;
}

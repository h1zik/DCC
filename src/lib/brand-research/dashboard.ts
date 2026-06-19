import { prisma } from "@/lib/prisma";

export type BrandHubDashboardData = {
  strategyCount: number;
  strategyReadyCount: number;
  creativeGuidelineCount: number;
  creativeReadyCount: number;
  visualAssetCount: number;
  visualCollectionCount: number;
  competitorCount: number;
  reviewSourceCount: number;
  trendDigestCount: number;
  keywordQueryCount: number;
  uspAnalysisCount: number;
  socialMonitorCount: number;
  activeAlerts: number;
  pendingJobs: number;
};

export async function getBrandHubDashboardData(
  userId: string,
  ownerBrandId?: string | null,
): Promise<BrandHubDashboardData> {
  const brandFilter = ownerBrandId ? { ownerBrandId } : {};

  const [
    strategyCount,
    strategyReadyCount,
    creativeGuidelineCount,
    creativeReadyCount,
    visualAssetCount,
    visualCollectionCount,
    competitorCount,
    reviewSourceCount,
    trendDigestCount,
    keywordQueryCount,
    uspAnalysisCount,
    socialMonitorCount,
    activeAlerts,
    pendingJobs,
  ] = await Promise.all([
    prisma.brandStrategyDocument.count({
      where: { createdById: userId, ...brandFilter },
    }),
    prisma.brandStrategyDocument.count({
      where: { createdById: userId, status: "READY", ...brandFilter },
    }),
    prisma.brandCreativeGuideline.count({
      where: { createdById: userId, ...brandFilter },
    }),
    prisma.brandCreativeGuideline.count({
      where: { createdById: userId, status: "READY", ...brandFilter },
    }),
    prisma.brandVisualAsset.count({
      where: brandFilter,
    }),
    prisma.brandVisualCollection.count({
      where: { createdById: userId, ...brandFilter },
    }),
    prisma.brandCompetitor.count({ where: { createdById: userId } }),
    prisma.brandReviewSource.count({ where: { createdById: userId } }),
    prisma.brandTrendDigest.count(),
    prisma.brandKeywordQuery.count({ where: { createdById: userId } }),
    prisma.brandUspAnalysis.count({ where: { createdById: userId } }),
    prisma.brandSocialMonitor.count({ where: { createdById: userId } }),
    prisma.brandCompetitorAlert.count({
      where: { isRead: false },
    }),
    prisma.brandResearchScrapeJob.count({
      where: { status: { in: ["PENDING", "RUNNING"] } },
    }),
  ]);

  return {
    strategyCount,
    strategyReadyCount,
    creativeGuidelineCount,
    creativeReadyCount,
    visualAssetCount,
    visualCollectionCount,
    competitorCount,
    reviewSourceCount,
    trendDigestCount,
    keywordQueryCount,
    uspAnalysisCount,
    socialMonitorCount,
    activeAlerts,
    pendingJobs,
  };
}

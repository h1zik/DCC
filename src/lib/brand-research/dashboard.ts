import { prisma } from "@/lib/prisma";

export type BrandHubDashboardData = {
  competitorCount: number;
  reviewSourceCount: number;
  trendDigestCount: number;
  keywordQueryCount: number;
  uspAnalysisCount: number;
  socialMonitorCount: number;
  activeAlerts: number;
  pendingJobs: number;
};

export async function getBrandHubDashboardData(userId: string): Promise<BrandHubDashboardData> {
  const [
    competitorCount,
    reviewSourceCount,
    trendDigestCount,
    keywordQueryCount,
    uspAnalysisCount,
    socialMonitorCount,
    activeAlerts,
    pendingJobs,
  ] = await Promise.all([
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
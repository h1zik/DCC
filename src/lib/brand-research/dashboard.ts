import { isApifyConfigured } from "@/lib/apify/client";
import { prisma } from "@/lib/prisma";
import {
  buildBrandHubModuleHealth,
  type BrandModuleHealth,
} from "@/lib/brand-research/dashboard-health";
import {
  countResearchCompetitorAlertsUnread,
  countResearchCompetitorsTotal,
  countResearchCompetitorsActive,
  countResearchKeywordQueriesReady,
  countResearchKeywordQueriesTotal,
  countResearchPendingJobs,
  countResearchReviewSourcesFailed,
  countResearchReviewSourcesReady,
  countResearchReviewSourcesTotal,
  countResearchSocialBatchesReady,
  countResearchTrendDigestsReady,
  countResearchUspAnalysesReady,
  countResearchUspAnalysesTotal,
} from "@/lib/brand-research/research-hub-readers";

export type BrandHubDashboardData = {
  strategyCount: number;
  strategyReadyCount: number;
  creativeGuidelineCount: number;
  creativeReadyCount: number;
  visualAssetCount: number;
  visualCollectionCount: number;
  competitorCount: number;
  reviewSourceReadyCount: number;
  trendDigestCount: number;
  keywordQueryReadyCount: number;
  uspAnalysisReadyCount: number;
  socialBatchReadyCount: number;
  activeAlerts: number;
  pendingJobs: number;
  health: BrandModuleHealth[];
};

function brandFilter(ownerBrandId?: string | null) {
  return ownerBrandId ? { ownerBrandId } : {};
}

function userBrandFilter(userId: string, ownerBrandId?: string | null) {
  return { createdById: userId, ...brandFilter(ownerBrandId) };
}

export async function getBrandHubDashboardData(
  userId: string,
  ownerBrandId?: string | null,
): Promise<BrandHubDashboardData> {
  const brandFilterClause = brandFilter(ownerBrandId);
  const userBrandFilterClause = userBrandFilter(userId, ownerBrandId);

  const [
    strategyCount,
    strategyReadyCount,
    creativeGuidelineCount,
    creativeReadyCount,
    visualAssetCount,
    visualCollectionCount,
    competitorCount,
    competitorActiveCount,
    reviewReadyCount,
    reviewFailedCount,
    reviewTotalCount,
    trendDigestCount,
    keywordReadyCount,
    keywordTotalCount,
    uspReadyCount,
    uspTotalCount,
    socialReadyCount,
    activeAlerts,
    pendingJobs,
    visualDemoAsset,
    socialDemoBatch,
    trendDemo,
  ] = await Promise.all([
    prisma.brandStrategyDocument.count({
      where: userBrandFilterClause,
    }),
    prisma.brandStrategyDocument.count({
      where: { ...userBrandFilterClause, status: "READY" },
    }),
    prisma.brandCreativeGuideline.count({
      where: userBrandFilterClause,
    }),
    prisma.brandCreativeGuideline.count({
      where: { ...userBrandFilterClause, status: "READY" },
    }),
    prisma.brandVisualAsset.count({
      where: brandFilterClause,
    }),
    prisma.brandVisualCollection.count({
      where: userBrandFilterClause,
    }),
    countResearchCompetitorsTotal(),
    countResearchCompetitorsActive(),
    countResearchReviewSourcesReady(),
    countResearchReviewSourcesFailed(),
    countResearchReviewSourcesTotal(),
    countResearchTrendDigestsReady(),
    countResearchKeywordQueriesReady(),
    countResearchKeywordQueriesTotal(),
    countResearchUspAnalysesReady(),
    countResearchUspAnalysesTotal(),
    countResearchSocialBatchesReady(),
    countResearchCompetitorAlertsUnread(),
    countResearchPendingJobs(),
    isApifyConfigured()
      ? prisma.brandVisualAsset.count({
          where: {
            ...brandFilterClause,
            source: "PINTEREST",
            metadata: { path: ["demo"], equals: true },
          },
        }).then((n) => n > 0)
      : Promise.resolve(true),
    prisma.socialListeningBatch
      .findMany({
        where: { status: "READY" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { errorMessage: true, summary: { select: { aiSummary: true } } },
      })
      .then((batches) =>
        batches.some((b) =>
          `${b.errorMessage ?? ""} ${b.summary?.aiSummary ?? ""}`
            .toLowerCase()
            .includes("demo"),
        ),
      ),
    prisma.trendRadarDigest
      .findMany({
        where: { status: "READY" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { narrative: true },
      })
      .then((digests) =>
        digests.some((d) => d.narrative?.toLowerCase().includes("demo")),
      ),
  ]);

  const health = buildBrandHubModuleHealth({
    reviewReady: reviewReadyCount,
    reviewFailed: reviewFailedCount,
    reviewTotal: reviewTotalCount,
    socialReady: socialReadyCount,
    socialDemoBatch,
    trendReady: trendDigestCount,
    trendDemo,
    keywordReady: keywordReadyCount,
    keywordTotal: keywordTotalCount,
    competitorActive: competitorActiveCount,
    competitorTotal: competitorCount,
    visualAssetCount,
    visualDemoAsset,
    uspReady: uspReadyCount,
    uspTotal: uspTotalCount,
    strategyReady: strategyReadyCount,
    strategyTotal: strategyCount,
    creativeReady: creativeReadyCount,
    creativeTotal: creativeGuidelineCount,
    visualCollectionCount,
  });

  return {
    strategyCount,
    strategyReadyCount,
    creativeGuidelineCount,
    creativeReadyCount,
    visualAssetCount,
    visualCollectionCount,
    competitorCount,
    reviewSourceReadyCount: reviewReadyCount,
    trendDigestCount,
    keywordQueryReadyCount: keywordReadyCount,
    uspAnalysisReadyCount: uspReadyCount,
    socialBatchReadyCount: socialReadyCount,
    activeAlerts,
    pendingJobs,
    health,
  };
}

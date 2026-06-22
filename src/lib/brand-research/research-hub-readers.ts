import "server-only";

import { prisma } from "@/lib/prisma";

/** Org-wide read layer: Brand Hub consumes Research Hub data (no createdById filter). */

export async function countResearchReviewSourcesReady(): Promise<number> {
  return prisma.reviewIntelSource.count({ where: { status: "READY" } });
}

export async function countResearchReviewSourcesFailed(): Promise<number> {
  return prisma.reviewIntelSource.count({ where: { status: "FAILED" } });
}

export async function countResearchReviewSourcesTotal(): Promise<number> {
  return prisma.reviewIntelSource.count();
}

export async function listResearchReviewSourcesForBrandHub() {
  return prisma.reviewIntelSource.findMany({
    where: { status: "READY" },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, productName: true, competitorBrand: true },
  });
}

export async function listResearchCompetitorsForBrandHub() {
  return prisma.researchCompetitor.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      skus: { select: { rating: true, imageUrl: true } },
      _count: { select: { skus: true, alerts: { where: { isRead: false } } } },
    },
  });
}

export async function countResearchCompetitorsActive(): Promise<number> {
  return prisma.researchCompetitor.count({
    where: { isActive: true, skus: { some: {} } },
  });
}

export async function countResearchCompetitorsTotal(): Promise<number> {
  return prisma.researchCompetitor.count();
}

export async function getResearchCompetitorById(id: string) {
  return prisma.researchCompetitor.findUnique({ where: { id } });
}

export async function listResearchSocialMonitorsForBrandHub() {
  return prisma.socialListeningMonitor.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      batches: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          collectedAt: true,
          errorMessage: true,
          _count: {
            select: {
              mentions: true,
            },
          },
        },
      },
    },
  });
}

export async function countResearchSocialThumbnailMentions(
  batchId: string,
): Promise<number> {
  return prisma.socialMention.count({
    where: { batchId, thumbnailUrl: { not: null } },
  });
}

export async function countResearchSocialBatchesReady(): Promise<number> {
  return prisma.socialListeningBatch.count({
    where: { status: "READY" },
  });
}

export async function getResearchSocialMonitorById(id: string) {
  return prisma.socialListeningMonitor.findUnique({ where: { id } });
}

export async function listResearchKeywordQueriesForBrandHub() {
  const [researchQueries, brandQueries] = await Promise.all([
    prisma.keywordIntelQuery.findMany({
      where: { status: "READY" },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, seedKeyword: true, category: true },
    }),
    prisma.brandKeywordQuery.findMany({
      where: { status: "READY" },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, seedKeyword: true, category: true },
    }),
  ]);

  return [
    ...researchQueries.map((q) => ({
      id: q.id,
      seedKeyword: q.seedKeyword,
      category: q.category,
      hub: "research" as const,
    })),
    ...brandQueries.map((q) => ({
      id: q.id,
      seedKeyword: q.seedKeyword,
      category: q.category,
      hub: "brand" as const,
    })),
  ];
}

export async function countResearchKeywordQueriesReady(): Promise<number> {
  const [research, brand] = await Promise.all([
    prisma.keywordIntelQuery.count({ where: { status: "READY" } }),
    prisma.brandKeywordQuery.count({ where: { status: "READY" } }),
  ]);
  return research + brand;
}

export async function countResearchKeywordQueriesTotal(): Promise<number> {
  const [research, brand] = await Promise.all([
    prisma.keywordIntelQuery.count(),
    prisma.brandKeywordQuery.count(),
  ]);
  return research + brand;
}

export async function listResearchTrendDigestsForBrandHub() {
  return prisma.trendRadarDigest.findMany({
    where: { status: "READY" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, isGlobal: true, narrative: true },
  });
}

export async function countResearchTrendDigestsReady(): Promise<number> {
  return prisma.trendRadarDigest.count({ where: { status: "READY" } });
}

export async function getLatestResearchTrendDigestWithItems() {
  return prisma.trendRadarDigest.findFirst({
    where: { status: "READY" },
    orderBy: { generatedAt: "desc" },
    include: {
      items: { orderBy: { score: "desc" }, take: 5 },
    },
  });
}

export async function listResearchUspAnalysesForBrandHub() {
  return prisma.uspGapAnalysis.findMany({
    where: { status: "READY" },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { id: true, category: true },
  });
}

export async function countResearchUspAnalysesReady(): Promise<number> {
  return prisma.uspGapAnalysis.count({ where: { status: "READY" } });
}

export async function countResearchUspAnalysesTotal(): Promise<number> {
  return prisma.uspGapAnalysis.count();
}

export async function countResearchCompetitorAlertsUnread(): Promise<number> {
  return prisma.competitorAlert.count({ where: { isRead: false } });
}

export async function listResearchProductDiscoveryForBrandHub() {
  return prisma.productDiscoveryQuery.findMany({
    where: { status: "READY" },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      keyword: true,
      productCount: true,
      marketplaces: true,
    },
  });
}

export async function countResearchPendingJobs(): Promise<number> {
  return prisma.researchScrapeJob.count({
    where: { status: { in: ["PENDING", "RUNNING"] } },
  });
}

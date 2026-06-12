import "server-only";

import { prisma } from "@/lib/prisma";
import { gatherUspContext } from "@/lib/research/usp-gap/gather-context";

export type ReportAggregate = {
  periodStart: Date;
  periodEnd: Date;
  activity: {
    reviewSourcesReady: number;
    competitorsTracked: number;
    trendDigests: number;
    keywordQueries: number;
    socialBatches: number;
    uspAnalyses: number;
    productConcepts: number;
  };
  highlights: {
    topComplaints: { theme: string; count: number }[];
    topTrends: { name: string; phase: string }[];
    gapKeywords: { keyword: string; reason: string }[];
    socialPainPoints: { theme: string; count: number }[];
    latestUspSummary: string | null;
  };
  categoryContext: Awaited<ReturnType<typeof gatherUspContext>> | null;
  competitorSnapshot: {
    name: string;
    brand: string;
    skuCount: number;
    priceRange: { min: number; max: number } | null;
  } | null;
  trendDigest: {
    id: string;
    narrative: string | null;
    items: { name: string; phase: string; dimension: string }[];
  } | null;
};

export async function aggregateReportData(input: {
  periodStart: Date;
  periodEnd: Date;
  category?: string;
  competitorId?: string;
  digestId?: string;
  modules?: Record<string, boolean | undefined>;
}): Promise<ReportAggregate> {
  const { periodStart, periodEnd } = input;

  const [
    reviewSourcesReady,
    competitorsTracked,
    trendDigests,
    keywordQueries,
    socialBatches,
    uspAnalyses,
    productConcepts,
    latestReview,
    latestDigest,
    latestSocial,
    latestUsp,
  ] = await Promise.all([
    prisma.reviewIntelSource.count({
      where: { status: "READY", updatedAt: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.researchCompetitor.count({ where: { isActive: true } }),
    prisma.trendRadarDigest.count({
      where: { status: "READY", createdAt: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.keywordIntelQuery.count({
      where: { status: "READY", updatedAt: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.socialListeningBatch.count({
      where: { status: "READY", collectedAt: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.uspGapAnalysis.count({
      where: { status: "READY", updatedAt: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.productConcept.count({
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.reviewIntelSource.findFirst({
      where: { status: "READY" },
      include: { summary: true },
      orderBy: { updatedAt: "desc" },
    }),
    input.digestId
      ? prisma.trendRadarDigest.findUnique({
          where: { id: input.digestId },
          include: { items: { take: 10, orderBy: { score: "desc" } } },
        })
      : prisma.trendRadarDigest.findFirst({
          where: { status: "READY" },
          include: { items: { take: 10, orderBy: { score: "desc" } } },
          orderBy: { createdAt: "desc" },
        }),
    prisma.socialListeningBatch.findFirst({
      where: { status: "READY" },
      include: { summary: true },
      orderBy: { collectedAt: "desc" },
    }),
    prisma.uspGapAnalysis.findFirst({
      where: { status: "READY" },
      include: { result: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const topComplaints =
    latestReview?.summary &&
    Array.isArray(latestReview.summary.topComplaints)
      ? (latestReview.summary.topComplaints as { theme: string; count: number }[]).slice(
          0,
          5,
        )
      : [];

  const topTrends =
    latestDigest?.items.map((i) => ({
      name: i.name,
      phase: i.phase,
    })) ?? [];

  let gapKeywords: { keyword: string; reason: string }[] = [];
  if (input.category) {
    const kw = await prisma.keywordIntelQuery.findFirst({
      where: { status: "READY", category: { contains: input.category, mode: "insensitive" } },
      include: { result: true },
      orderBy: { updatedAt: "desc" },
    });
    if (kw?.result && Array.isArray(kw.result.gapKeywords)) {
      gapKeywords = (
        kw.result.gapKeywords as { keyword: string; reason: string }[]
      ).slice(0, 8);
    }
  }

  const socialPainPoints =
    latestSocial?.summary &&
    Array.isArray(latestSocial.summary.topPainPoints)
      ? (
          latestSocial.summary.topPainPoints as { theme: string; count: number }[]
        ).slice(0, 5)
      : [];

  let competitorSnapshot: ReportAggregate["competitorSnapshot"] = null;
  if (input.competitorId) {
    const comp = await prisma.researchCompetitor.findUnique({
      where: { id: input.competitorId },
      include: { skus: true },
    });
    if (comp) {
      const prices = comp.skus
        .map((s) => s.currentPrice)
        .filter((p): p is number => typeof p === "number" && p > 0);
      competitorSnapshot = {
        name: comp.name,
        brand: comp.brand,
        skuCount: comp.skus.length,
        priceRange:
          prices.length > 0
            ? { min: Math.min(...prices), max: Math.max(...prices) }
            : null,
      };
    }
  }

  let categoryContext: ReportAggregate["categoryContext"] = null;
  if (input.category) {
    categoryContext = await gatherUspContext({
      category: input.category,
      contextModules: {
        reviewIntel: true,
        competitor: true,
        trendRadar: true,
        keywordIntel: true,
        socialListening: true,
      },
    });
  }

  return {
    periodStart,
    periodEnd,
    activity: {
      reviewSourcesReady,
      competitorsTracked,
      trendDigests,
      keywordQueries,
      socialBatches,
      uspAnalyses,
      productConcepts,
    },
    highlights: {
      topComplaints,
      topTrends,
      gapKeywords,
      socialPainPoints,
      latestUspSummary: latestUsp?.result?.aiSummary ?? null,
    },
    categoryContext,
    competitorSnapshot,
    trendDigest: latestDigest
      ? {
          id: latestDigest.id,
          narrative: latestDigest.narrative,
          items: latestDigest.items.map((i) => ({
            name: i.name,
            phase: i.phase,
            dimension: i.dimension,
          })),
        }
      : null,
  };
}

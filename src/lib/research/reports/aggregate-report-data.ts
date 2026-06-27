import "server-only";

import { prisma } from "@/lib/prisma";
import { gatherUspContext, type UspGatheredContext } from "@/lib/research/usp-gap/gather-context";

export type ReportActionItem = {
  module: string;
  owner: string;
  priority: string;
  action: string;
  rationale: string;
  sourceLabel: string | null;
  href: string | null;
};

export type ReportUspDetail = {
  category: string;
  differentiationScore: number | null;
  categoryDecision: {
    verdict: string;
    confidence: number;
    reason: string;
  } | null;
  topGaps: {
    claim: string;
    gapScore: number;
    priority?: string;
    recommendedAction?: string;
  }[];
  topUsps: { usp: string; differentiationScore: number }[];
};

export type ReportConceptDetail = {
  title: string;
  decision: string | null;
  marketDemand: number | null;
  differentiation: number | null;
  overall: number | null;
};

export type ReportFeedbackLoop = {
  nodes: { name: string }[];
  links: { source: string; target: string; value: number }[];
};

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
  uspDetail: ReportUspDetail | null;
  conceptDetail: ReportConceptDetail[];
  actionItems: ReportActionItem[];
  feedbackLoop: ReportFeedbackLoop;
  categoryContext: UspGatheredContext | null;
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

type ModuleFlags = Record<string, boolean | undefined>;

/** If no modules are explicitly enabled, treat all as enabled (backwards compatible). */
function makeModuleGate(modules?: ModuleFlags): (key: string) => boolean {
  const hasAnyEnabled =
    !!modules && Object.values(modules).some((v) => v === true);
  if (!hasAnyEnabled) return () => true;
  return (key: string) => modules?.[key] === true;
}

/**
 * Deterministic 3-tier flow: raw signals -> insight engine -> concepts.
 * Powers the feedback-loop Sankey in the report.
 */
function buildFeedbackLoop(counts: {
  reviewSourcesReady: number;
  socialBatches: number;
  trendDigests: number;
  keywordQueries: number;
  uspAnalyses: number;
  productConcepts: number;
}): ReportFeedbackLoop {
  const signalTotal =
    counts.reviewSourcesReady +
    counts.socialBatches +
    counts.trendDigests +
    counts.keywordQueries;
  const insightTotal = Math.max(counts.uspAnalyses, 1);

  const nodes = [
    { name: "Review Intel" },
    { name: "Social Listening" },
    { name: "Trend Radar" },
    { name: "Keyword Intel" },
    { name: "Insight Engine" },
    { name: "USP & Gap" },
    { name: "Konsep Produk" },
  ];

  const links = [
    { source: "Review Intel", target: "Insight Engine", value: counts.reviewSourcesReady },
    { source: "Social Listening", target: "Insight Engine", value: counts.socialBatches },
    { source: "Trend Radar", target: "Insight Engine", value: counts.trendDigests },
    { source: "Keyword Intel", target: "Insight Engine", value: counts.keywordQueries },
    { source: "Insight Engine", target: "USP & Gap", value: counts.uspAnalyses },
    {
      source: "USP & Gap",
      target: "Konsep Produk",
      value: counts.productConcepts,
    },
  ]
    // Sankey breaks on zero-value links; keep a minimum weight so the flow renders.
    .map((l) => ({ ...l, value: Math.max(l.value, 0) }))
    .filter((l) => l.value > 0 || signalTotal > 0 || insightTotal > 0)
    .map((l) => ({ ...l, value: l.value > 0 ? l.value : 1 }));

  return { nodes, links };
}

export async function aggregateReportData(input: {
  periodStart: Date;
  periodEnd: Date;
  category?: string;
  competitorId?: string;
  digestId?: string;
  modules?: Record<string, boolean | undefined>;
  sources?: {
    reviewSourceId?: string;
    competitorId?: string;
    digestId?: string;
    keywordQueryId?: string;
    socialMonitorId?: string;
    uspAnalysisId?: string;
    conceptId?: string;
    productDiscoveryQueryId?: string;
  };
}): Promise<ReportAggregate> {
  const { periodStart, periodEnd } = input;
  const isEnabled = makeModuleGate(input.modules);
  const sources = input.sources;
  const effectiveCompetitorId = sources?.competitorId ?? input.competitorId;
  const effectiveDigestId = sources?.digestId ?? input.digestId;

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
      where: sources?.reviewSourceId
        ? { id: sources.reviewSourceId, status: "READY" }
        : { status: "READY" },
      include: { summary: true },
      orderBy: { updatedAt: "desc" },
    }),
    effectiveDigestId
      ? prisma.trendRadarDigest.findUnique({
          where: { id: effectiveDigestId },
          include: { items: { take: 10, orderBy: { score: "desc" } } },
        })
      : prisma.trendRadarDigest.findFirst({
          where: { status: "READY" },
          include: { items: { take: 10, orderBy: { score: "desc" } } },
          orderBy: { createdAt: "desc" },
        }),
    prisma.socialListeningBatch.findFirst({
      where: sources?.socialMonitorId
        ? { monitorId: sources.socialMonitorId, status: "READY" }
        : { status: "READY" },
      include: { summary: true },
      orderBy: { collectedAt: "desc" },
    }),
    prisma.uspGapAnalysis.findFirst({
      where: sources?.uspAnalysisId
        ? { id: sources.uspAnalysisId, status: "READY" }
        : { status: "READY" },
      include: { result: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const topComplaints =
    isEnabled("reviewIntel") &&
    latestReview?.summary &&
    Array.isArray(latestReview.summary.topComplaints)
      ? (latestReview.summary.topComplaints as { theme: string; count: number }[]).slice(
          0,
          5,
        )
      : [];

  const topTrends = isEnabled("trendRadar")
    ? (latestDigest?.items.map((i) => ({
        name: i.name,
        phase: i.phase,
      })) ?? [])
    : [];

  let gapKeywords: { keyword: string; reason: string }[] = [];
  if (isEnabled("keywordIntel")) {
    const kw = sources?.keywordQueryId
      ? await prisma.keywordIntelQuery.findUnique({
          where: { id: sources.keywordQueryId },
          include: { result: true },
        })
      : input.category
        ? await prisma.keywordIntelQuery.findFirst({
            where: {
              status: "READY",
              category: { contains: input.category, mode: "insensitive" },
            },
            include: { result: true },
            orderBy: { updatedAt: "desc" },
          })
        : null;
    if (kw?.result && Array.isArray(kw.result.gapKeywords)) {
      gapKeywords = (
        kw.result.gapKeywords as { keyword: string; reason: string }[]
      ).slice(0, 8);
    }
  }

  const socialPainPoints =
    isEnabled("socialListening") &&
    latestSocial?.summary &&
    Array.isArray(latestSocial.summary.topPainPoints)
      ? (
          latestSocial.summary.topPainPoints as { theme: string; count: number }[]
        ).slice(0, 5)
      : [];

  let competitorSnapshot: ReportAggregate["competitorSnapshot"] = null;
  if (effectiveCompetitorId && isEnabled("competitor")) {
    const comp = await prisma.researchCompetitor.findUnique({
      where: { id: effectiveCompetitorId },
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
    categoryContext = (
      await gatherUspContext({
        category: input.category,
        contextModules: {
          reviewIntel: isEnabled("reviewIntel"),
          competitor: isEnabled("competitor"),
          trendRadar: isEnabled("trendRadar"),
          keywordIntel: isEnabled("keywordIntel"),
          socialListening: isEnabled("socialListening"),
          reviewSourceIds: sources?.reviewSourceId
            ? [sources.reviewSourceId]
            : undefined,
          competitorIds: sources?.competitorId
            ? [sources.competitorId]
            : undefined,
          trendDigestId: sources?.digestId,
          keywordQueryId: sources?.keywordQueryId,
          socialMonitorId: sources?.socialMonitorId,
        },
      })
    ).context;
  }

  let uspDetail: ReportUspDetail | null = null;
  if (isEnabled("uspAnalyzer") && latestUsp?.result) {
    const gm = Array.isArray(latestUsp.result.gapMatrix)
      ? (latestUsp.result.gapMatrix as {
          claim: string;
          gapScore: number;
          priority?: string;
          recommendedAction?: string;
        }[])
      : [];
    const usps = Array.isArray(latestUsp.result.uspCandidates)
      ? (latestUsp.result.uspCandidates as {
          usp: string;
          differentiationScore: number;
        }[])
      : [];
    const decision =
      latestUsp.result.categoryDecision &&
      typeof latestUsp.result.categoryDecision === "object"
        ? (latestUsp.result.categoryDecision as ReportUspDetail["categoryDecision"])
        : null;
    uspDetail = {
      category: latestUsp.category,
      differentiationScore: latestUsp.result.differentiationScore ?? null,
      categoryDecision: decision,
      topGaps: [...gm]
        .sort((a, b) => (b.gapScore ?? 0) - (a.gapScore ?? 0))
        .slice(0, 5)
        .map((g) => ({
          claim: g.claim,
          gapScore: g.gapScore,
          priority: g.priority,
          recommendedAction: g.recommendedAction,
        })),
      topUsps: [...usps]
        .sort(
          (a, b) =>
            (b.differentiationScore ?? 0) - (a.differentiationScore ?? 0),
        )
        .slice(0, 5)
        .map((u) => ({
          usp: u.usp,
          differentiationScore: u.differentiationScore,
        })),
    };
  }

  let conceptDetail: ReportConceptDetail[] = [];
  if (isEnabled("conceptLab")) {
    const mapConcept = (c: {
      title: string;
      validationScores: unknown;
    }): ReportConceptDetail => {
      const scores =
        c.validationScores && typeof c.validationScores === "object"
          ? (c.validationScores as Record<string, unknown>)
          : {};
      const num = (v: unknown) =>
        typeof v === "number" && Number.isFinite(v) ? v : null;
      return {
        title: c.title,
        decision:
          typeof scores.decision === "string" ? (scores.decision as string) : null,
        marketDemand: num(scores.marketDemand),
        differentiation: num(scores.differentiation),
        overall: num(scores.overall),
      };
    };

    if (sources?.conceptId) {
      const c = await prisma.productConcept.findUnique({
        where: { id: sources.conceptId },
      });
      conceptDetail = c ? [mapConcept(c)] : [];
    } else {
      const concepts = await prisma.productConcept.findMany({
        where: { createdAt: { gte: periodStart, lte: periodEnd } },
        orderBy: { createdAt: "desc" },
        take: 8,
      });
      conceptDetail = concepts.map(mapConcept);
    }
  }

  const recommendations = await prisma.researchRecommendation.findMany({
    where: { status: "OPEN" },
    orderBy: [{ priority: "asc" }, { confidence: "desc" }],
    take: 12,
  });
  const enabledModuleKeys = new Set(
    [
      "reviewIntel",
      "competitor",
      "trendRadar",
      "keywordIntel",
      "socialListening",
      "uspAnalyzer",
      "conceptLab",
    ].filter((k) => isEnabled(k)),
  );
  const moduleToFlag: Record<string, string> = {
    "review-intelligence": "reviewIntel",
    "competitor-tracker": "competitor",
    "trend-radar": "trendRadar",
    "keyword-intel": "keywordIntel",
    "social-listening": "socialListening",
    "usp-gap": "uspAnalyzer",
    "concept-lab": "conceptLab",
  };
  const actionItems: ReportActionItem[] = recommendations
    .filter((r) => {
      const flag = moduleToFlag[r.module];
      return !flag || enabledModuleKeys.has(flag);
    })
    .map((r) => ({
      module: r.module,
      owner: r.owner,
      priority: r.priority,
      action: r.action,
      rationale: r.rationale,
      sourceLabel: r.sourceLabel,
      href: r.href,
    }));

  const feedbackLoop = buildFeedbackLoop({
    reviewSourcesReady,
    socialBatches,
    trendDigests,
    keywordQueries,
    uspAnalyses,
    productConcepts,
  });

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
      latestUspSummary: isEnabled("uspAnalyzer")
        ? (latestUsp?.result?.aiSummary ?? null)
        : null,
    },
    uspDetail,
    conceptDetail,
    actionItems,
    feedbackLoop,
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

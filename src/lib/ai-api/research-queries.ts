import { prisma } from "@/lib/prisma";
import { getResearchDashboardData } from "@/lib/research/dashboard/get-dashboard-data";
import type { AiApiRole } from "./auth";
import { canViewResearch } from "./auth";

function denied(message: string) {
  return { accessible: false as const, message, data: null };
}

function iso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

/* -------------------------------------------------------------------------- */
/* Dashboard & recommendations                                                */
/* -------------------------------------------------------------------------- */

export async function aiGetResearchDashboard(role: AiApiRole) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  return { accessible: true as const, data: await getResearchDashboardData() };
}

export async function aiListResearchRecommendations(
  role: AiApiRole,
  limit = 30,
) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const rows = await prisma.researchRecommendation.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      module: true,
      owner: true,
      priority: true,
      action: true,
      rationale: true,
      confidence: true,
      effort: true,
      horizon: true,
      sourceLabel: true,
      href: true,
      status: true,
      createdAt: true,
    },
  });
  return {
    accessible: true as const,
    count: rows.length,
    items: rows.map((r) => ({ ...r, createdAt: iso(r.createdAt) })),
  };
}

/* -------------------------------------------------------------------------- */
/* Competitor tracker                                                         */
/* -------------------------------------------------------------------------- */

export async function aiListResearchCompetitors(role: AiApiRole, limit = 40) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const rows = await prisma.researchCompetitor.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      brand: true,
      category: true,
      marketplace: true,
      shopUrl: true,
      isActive: true,
      updatedAt: true,
      _count: { select: { skus: true, alerts: true } },
    },
  });
  return {
    accessible: true as const,
    count: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      brand: r.brand,
      category: r.category,
      marketplace: r.marketplace,
      shopUrl: r.shopUrl,
      isActive: r.isActive,
      skuCount: r._count.skus,
      alertCount: r._count.alerts,
      updatedAt: iso(r.updatedAt),
    })),
  };
}

export async function aiGetResearchCompetitor(role: AiApiRole, competitorId: string) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const competitor = await prisma.researchCompetitor.findUnique({
    where: { id: competitorId },
    include: {
      skus: { orderBy: { reviewCount: "desc" }, take: 50 },
      alerts: { orderBy: { createdAt: "desc" }, take: 20 },
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 30,
        include: { sku: { select: { name: true } } },
      },
    },
  });
  if (!competitor) {
    return { accessible: true as const, found: false as const, data: null };
  }
  return {
    accessible: true as const,
    found: true as const,
    data: {
      id: competitor.id,
      name: competitor.name,
      brand: competitor.brand,
      category: competitor.category,
      marketplace: competitor.marketplace,
      shopUrl: competitor.shopUrl,
      isActive: competitor.isActive,
      aiInsights: competitor.aiInsights,
      aiMeta: competitor.aiMeta,
      updatedAt: iso(competitor.updatedAt),
      skus: competitor.skus.map((s) => ({
        id: s.id,
        name: s.name,
        productUrl: s.productUrl,
        currentPrice: s.currentPrice,
        rating: s.rating,
        reviewCount: s.reviewCount,
        lastSeenAt: iso(s.lastSeenAt),
      })),
      alerts: competitor.alerts.map((a) => ({
        id: a.id,
        type: a.type,
        message: a.message,
        severity: a.severity,
        isRead: a.isRead,
        createdAt: iso(a.createdAt),
      })),
      recentSnapshots: competitor.snapshots.map((s) => ({
        id: s.id,
        skuName: s.sku?.name ?? null,
        price: s.price,
        rating: s.rating,
        reviewCount: s.reviewCount,
        hasPromo: s.hasPromo,
        promoText: s.promoText,
        capturedAt: iso(s.capturedAt),
      })),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Review intelligence                                                        */
/* -------------------------------------------------------------------------- */

export async function aiListReviewIntelSources(role: AiApiRole, limit = 40) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const rows = await prisma.reviewIntelSource.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      productName: true,
      competitorBrand: true,
      marketplace: true,
      productUrl: true,
      status: true,
      reviewCount: true,
      totalReviewsReported: true,
      reviewsComplete: true,
      lastAnalyzedAt: true,
      errorMessage: true,
      updatedAt: true,
    },
  });
  return {
    accessible: true as const,
    count: rows.length,
    items: rows.map((r) => ({
      ...r,
      lastAnalyzedAt: iso(r.lastAnalyzedAt),
      updatedAt: iso(r.updatedAt),
    })),
  };
}

export async function aiGetReviewIntelSource(role: AiApiRole, sourceId: string) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const source = await prisma.reviewIntelSource.findUnique({
    where: { id: sourceId },
    include: {
      summary: true,
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { analysis: true },
      },
    },
  });
  if (!source) {
    return { accessible: true as const, found: false as const, data: null };
  }
  return {
    accessible: true as const,
    found: true as const,
    data: {
      id: source.id,
      productName: source.productName,
      competitorBrand: source.competitorBrand,
      marketplace: source.marketplace,
      productUrl: source.productUrl,
      status: source.status,
      reviewCount: source.reviewCount,
      totalReviewsReported: source.totalReviewsReported,
      reviewsComplete: source.reviewsComplete,
      lastAnalyzedAt: iso(source.lastAnalyzedAt),
      errorMessage: source.errorMessage,
      summary: source.summary
        ? {
            positivePct: source.summary.positivePct,
            neutralPct: source.summary.neutralPct,
            negativePct: source.summary.negativePct,
            topComplaints: source.summary.topComplaints,
            topPraises: source.summary.topPraises,
            keywordCloud: source.summary.keywordCloud,
            gapOpportunity: source.summary.gapOpportunity,
            aiActionPlan: source.summary.aiActionPlan,
            severityByTheme: source.summary.severityByTheme,
            demographics: source.summary.demographics,
            aiMeta: source.summary.aiMeta,
            updatedAt: iso(source.summary.updatedAt),
          }
        : null,
      sampleReviews: source.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.text.slice(0, 500),
        sentiment: r.analysis?.sentiment ?? null,
        complaintThemes: r.analysis?.complaintThemes ?? [],
        praiseThemes: r.analysis?.praiseThemes ?? [],
      })),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Trend radar                                                                */
/* -------------------------------------------------------------------------- */

export async function aiListTrendDigests(role: AiApiRole, limit = 20) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const rows = await prisma.trendRadarDigest.findMany({
    orderBy: { weekStart: "desc" },
    take: limit,
    select: {
      id: true,
      weekStart: true,
      weekEnd: true,
      status: true,
      isGlobal: true,
      narrative: true,
      generatedAt: true,
      errorMessage: true,
      watchlist: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  });
  return {
    accessible: true as const,
    count: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      weekStart: iso(r.weekStart),
      weekEnd: iso(r.weekEnd),
      status: r.status,
      isGlobal: r.isGlobal,
      narrativePreview: r.narrative?.slice(0, 280) ?? null,
      itemCount: r._count.items,
      watchlist: r.watchlist,
      generatedAt: iso(r.generatedAt),
      errorMessage: r.errorMessage,
    })),
  };
}

export async function aiGetTrendDigest(role: AiApiRole, digestId: string) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const digest = await prisma.trendRadarDigest.findUnique({
    where: { id: digestId },
    include: {
      items: { orderBy: { score: "desc" } },
      watchlist: { select: { id: true, name: true, keywords: true } },
    },
  });
  if (!digest) {
    return { accessible: true as const, found: false as const, data: null };
  }
  return {
    accessible: true as const,
    found: true as const,
    data: {
      id: digest.id,
      weekStart: iso(digest.weekStart),
      weekEnd: iso(digest.weekEnd),
      status: digest.status,
      isGlobal: digest.isGlobal,
      narrative: digest.narrative,
      aiActionPlan: digest.aiActionPlan,
      aiMeta: digest.aiMeta,
      sourceConfig: digest.sourceConfig,
      watchlist: digest.watchlist,
      generatedAt: iso(digest.generatedAt),
      items: digest.items.map((i) => ({
        id: i.id,
        name: i.name,
        dimension: i.dimension,
        phase: i.phase,
        score: i.score,
        narrative: i.narrative,
        sources: i.sources,
        relatedProducts: i.relatedProducts,
      })),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Keyword intel                                                              */
/* -------------------------------------------------------------------------- */

export async function aiListKeywordQueries(role: AiApiRole, limit = 30) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const rows = await prisma.keywordIntelQuery.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      category: true,
      seedKeyword: true,
      marketplace: true,
      status: true,
      errorMessage: true,
      updatedAt: true,
      result: { select: { aiSummary: true, updatedAt: true } },
    },
  });
  return {
    accessible: true as const,
    count: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      category: r.category,
      seedKeyword: r.seedKeyword,
      marketplace: r.marketplace,
      status: r.status,
      errorMessage: r.errorMessage,
      aiSummaryPreview: r.result?.aiSummary?.slice(0, 200) ?? null,
      updatedAt: iso(r.updatedAt),
    })),
  };
}

export async function aiGetKeywordQuery(role: AiApiRole, queryId: string) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const query = await prisma.keywordIntelQuery.findUnique({
    where: { id: queryId },
    include: { result: true },
  });
  if (!query) {
    return { accessible: true as const, found: false as const, data: null };
  }
  return {
    accessible: true as const,
    found: true as const,
    data: {
      id: query.id,
      category: query.category,
      seedKeyword: query.seedKeyword,
      marketplace: query.marketplace,
      status: query.status,
      errorMessage: query.errorMessage,
      result: query.result
        ? {
            keywordMatrix: query.result.keywordMatrix,
            gapKeywords: query.result.gapKeywords,
            namingSuggestions: query.result.namingSuggestions,
            copyKeywords: query.result.copyKeywords,
            seasonalCalendar: query.result.seasonalCalendar,
            clusters: query.result.clusters,
            aiSummary: query.result.aiSummary,
            aiActionPlan: query.result.aiActionPlan,
            aiMeta: query.result.aiMeta,
            updatedAt: iso(query.result.updatedAt),
          }
        : null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Social listening                                                           */
/* -------------------------------------------------------------------------- */

export async function aiListSocialMonitors(role: AiApiRole, limit = 30) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const rows = await prisma.socialListeningMonitor.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      keywords: true,
      platforms: true,
      isActive: true,
      updatedAt: true,
      batches: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, collectedAt: true },
      },
    },
  });
  return {
    accessible: true as const,
    count: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      keywords: r.keywords,
      platforms: r.platforms,
      isActive: r.isActive,
      latestBatch: r.batches[0]
        ? {
            id: r.batches[0].id,
            status: r.batches[0].status,
            collectedAt: iso(r.batches[0].collectedAt),
          }
        : null,
      updatedAt: iso(r.updatedAt),
    })),
  };
}

export async function aiGetSocialMonitor(role: AiApiRole, monitorId: string) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const monitor = await prisma.socialListeningMonitor.findUnique({
    where: { id: monitorId },
    include: {
      batches: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          summary: true,
          mentions: {
            orderBy: { likes: "desc" },
            take: 25,
          },
        },
      },
    },
  });
  if (!monitor) {
    return { accessible: true as const, found: false as const, data: null };
  }
  const batch = monitor.batches[0] ?? null;
  return {
    accessible: true as const,
    found: true as const,
    data: {
      id: monitor.id,
      name: monitor.name,
      keywords: monitor.keywords,
      platforms: monitor.platforms,
      isActive: monitor.isActive,
      latestBatch: batch
        ? {
            id: batch.id,
            status: batch.status,
            collectedAt: iso(batch.collectedAt),
            summary: batch.summary
              ? {
                  topPainPoints: batch.summary.topPainPoints,
                  topWishlist: batch.summary.topWishlist,
                  influencers: batch.summary.influencers,
                  viralContent: batch.summary.viralContent,
                  categoryBreakdown: batch.summary.categoryBreakdown,
                  aiSummary: batch.summary.aiSummary,
                  aiActionPlan: batch.summary.aiActionPlan,
                  sentimentTimeline: batch.summary.sentimentTimeline,
                  aiMeta: batch.summary.aiMeta,
                }
              : null,
            topMentions: batch.mentions.map((m) => ({
              id: m.id,
              platform: m.platform,
              text: m.text.slice(0, 400),
              classification: m.classification,
              likes: m.likes,
              comments: m.comments,
              views: m.views,
              isViral: m.isViral,
              url: m.url,
            })),
          }
        : null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* USP analyzer                                                               */
/* -------------------------------------------------------------------------- */

export async function aiListUspAnalyses(role: AiApiRole, limit = 30) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const rows = await prisma.uspGapAnalysis.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      category: true,
      status: true,
      errorMessage: true,
      updatedAt: true,
      brand: { select: { id: true, name: true } },
      result: {
        select: {
          differentiationScore: true,
          aiSummary: true,
          categoryDecision: true,
        },
      },
    },
  });
  return {
    accessible: true as const,
    count: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      category: r.category,
      status: r.status,
      brand: r.brand,
      differentiationScore: r.result?.differentiationScore ?? null,
      aiSummaryPreview: r.result?.aiSummary?.slice(0, 200) ?? null,
      categoryDecision: r.result?.categoryDecision ?? null,
      errorMessage: r.errorMessage,
      updatedAt: iso(r.updatedAt),
    })),
  };
}

export async function aiGetUspAnalysis(role: AiApiRole, analysisId: string) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const analysis = await prisma.uspGapAnalysis.findUnique({
    where: { id: analysisId },
    include: {
      brand: { select: { id: true, name: true } },
      result: true,
    },
  });
  if (!analysis) {
    return { accessible: true as const, found: false as const, data: null };
  }
  return {
    accessible: true as const,
    found: true as const,
    data: {
      id: analysis.id,
      category: analysis.category,
      status: analysis.status,
      contextModules: analysis.contextModules,
      brand: analysis.brand,
      errorMessage: analysis.errorMessage,
      result: analysis.result
        ? {
            gapMatrix: analysis.result.gapMatrix,
            claimAnalysis: analysis.result.claimAnalysis,
            positioningMap: analysis.result.positioningMap,
            uspCandidates: analysis.result.uspCandidates,
            differentiationScore: analysis.result.differentiationScore,
            aiSummary: analysis.result.aiSummary,
            aiActionPlan: analysis.result.aiActionPlan,
            categoryDecision: analysis.result.categoryDecision,
            aiMeta: analysis.result.aiMeta,
            updatedAt: iso(analysis.result.updatedAt),
          }
        : null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Concept lab                                                                */
/* -------------------------------------------------------------------------- */

export async function aiListProductConcepts(role: AiApiRole, limit = 40) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const rows = await prisma.productConcept.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      category: true,
      mode: true,
      status: true,
      targetMarket: true,
      priceTargetMin: true,
      priceTargetMax: true,
      validationScores: true,
      createdAt: true,
      brand: { select: { id: true, name: true } },
    },
  });
  return {
    accessible: true as const,
    count: rows.length,
    items: rows.map((r) => {
      const scores =
        r.validationScores && typeof r.validationScores === "object"
          ? (r.validationScores as { overall?: number })
          : {};
      return {
        id: r.id,
        title: r.title,
        category: r.category,
        mode: r.mode,
        status: r.status,
        targetMarket: r.targetMarket,
        priceTargetMin: r.priceTargetMin,
        priceTargetMax: r.priceTargetMax,
        overallScore:
          typeof scores.overall === "number" ? scores.overall : null,
        brand: r.brand,
        createdAt: iso(r.createdAt),
      };
    }),
  };
}

export async function aiGetProductConcept(role: AiApiRole, conceptId: string) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const concept = await prisma.productConcept.findUnique({
    where: { id: conceptId },
    include: { brand: { select: { id: true, name: true } } },
  });
  if (!concept) {
    return { accessible: true as const, found: false as const, data: null };
  }
  return {
    accessible: true as const,
    found: true as const,
    data: {
      id: concept.id,
      title: concept.title,
      category: concept.category,
      mode: concept.mode,
      status: concept.status,
      targetMarket: concept.targetMarket,
      priceTargetMin: concept.priceTargetMin,
      priceTargetMax: concept.priceTargetMax,
      brand: concept.brand,
      sourceModules: concept.sourceModules,
      conceptData: concept.conceptData,
      validationScores: concept.validationScores,
      riskFactors: concept.riskFactors,
      aiMeta: concept.aiMeta,
      createdAt: iso(concept.createdAt),
      updatedAt: iso(concept.updatedAt),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Product discovery                                                          */
/* -------------------------------------------------------------------------- */

export async function aiListProductDiscoveryQueries(role: AiApiRole, limit = 30) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const rows = await prisma.productDiscoveryQuery.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      keyword: true,
      marketplaces: true,
      status: true,
      productCount: true,
      errorMessage: true,
      updatedAt: true,
      _count: { select: { products: true } },
    },
  });
  return {
    accessible: true as const,
    count: rows.length,
    items: rows.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      marketplaces: r.marketplaces,
      status: r.status,
      productCount: r.productCount,
      itemCount: r._count.products,
      errorMessage: r.errorMessage,
      updatedAt: iso(r.updatedAt),
    })),
  };
}

export async function aiGetProductDiscoveryQuery(role: AiApiRole, queryId: string) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const query = await prisma.productDiscoveryQuery.findUnique({
    where: { id: queryId },
    include: {
      products: {
        orderBy: [{ reviewCount: "desc" }, { soldCount: "desc" }],
        take: 50,
      },
    },
  });
  if (!query) {
    return { accessible: true as const, found: false as const, data: null };
  }
  return {
    accessible: true as const,
    found: true as const,
    data: {
      id: query.id,
      keyword: query.keyword,
      marketplaces: query.marketplaces,
      status: query.status,
      productCount: query.productCount,
      aiInsights: query.aiInsights,
      aiActionPlan: query.aiActionPlan,
      aiMeta: query.aiMeta,
      scrapeState: query.scrapeState,
      errorMessage: query.errorMessage,
      products: query.products.map((i) => ({
        id: i.id,
        marketplace: i.marketplace,
        name: i.name,
        shopName: i.shopName,
        price: i.price,
        rating: i.rating,
        reviewCount: i.reviewCount,
        soldCount: i.soldCount,
        hasPromo: i.hasPromo,
        promoText: i.promoText,
        categoryRank: i.categoryRank,
        productUrl: i.productUrl,
      })),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Research reports                                                           */
/* -------------------------------------------------------------------------- */

export async function aiListResearchReports(role: AiApiRole, limit = 20) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const rows = await prisma.researchReport.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      aiSummary: true,
      periodStart: true,
      periodEnd: true,
      createdAt: true,
      errorMessage: true,
    },
  });
  return {
    accessible: true as const,
    count: rows.length,
    items: rows.map((r) => ({
      ...r,
      aiSummaryPreview: r.aiSummary?.slice(0, 240) ?? null,
      aiSummary: undefined,
      periodStart: iso(r.periodStart),
      periodEnd: iso(r.periodEnd),
      createdAt: iso(r.createdAt),
    })),
  };
}

export async function aiGetResearchReport(role: AiApiRole, reportId: string) {
  if (!canViewResearch(role)) {
    return denied("Research Hub hanya untuk CEO/Administrator.");
  }
  const report = await prisma.researchReport.findUnique({
    where: { id: reportId },
  });
  if (!report) {
    return { accessible: true as const, found: false as const, data: null };
  }
  return {
    accessible: true as const,
    found: true as const,
    data: {
      id: report.id,
      title: report.title,
      type: report.type,
      status: report.status,
      config: report.config,
      sections: report.sections,
      aiSummary: report.aiSummary,
      actionItems: report.actionItems,
      feedbackLoop: report.feedbackLoop,
      metrics: report.metrics,
      aiMeta: report.aiMeta,
      periodStart: iso(report.periodStart),
      periodEnd: iso(report.periodEnd),
      errorMessage: report.errorMessage,
      createdAt: iso(report.createdAt),
    },
  };
}

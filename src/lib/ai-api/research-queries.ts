import { prisma } from "@/lib/prisma";
import { getResearchDashboardData } from "@/lib/research/dashboard/get-dashboard-data";
import { buildCompetitorInsights } from "@/lib/research/competitor-insights";
import type { AiApiRole } from "./auth";
import { canViewResearchHub } from "./auth";
import type { UserRole } from "@prisma/client";

export type ResearchReaderRole = UserRole | AiApiRole;

function denied(message: string) {
  return { accessible: false as const, message, data: null };
}

function iso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

function textMatchesQuery(text: string | null | undefined, query: string): boolean {
  if (!query) return true;
  if (!text) return false;
  return normalizeQuery(text).includes(normalizeQuery(query));
}

function summarizeSkuPrices(
  skus: { currentPrice: number | null; name: string }[],
) {
  const prices = skus
    .map((s) => s.currentPrice)
    .filter((p): p is number => p != null && p > 0);
  if (prices.length === 0) {
    return {
      skuWithPriceCount: 0,
      minPrice: null as number | null,
      maxPrice: null as number | null,
      avgPrice: null as number | null,
    };
  }
  const sum = prices.reduce((a, b) => a + b, 0);
  return {
    skuWithPriceCount: prices.length,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    avgPrice: Math.round(sum / prices.length),
  };
}

/* -------------------------------------------------------------------------- */
/* Dashboard & recommendations                                                */
/* -------------------------------------------------------------------------- */

export async function aiGetResearchDashboard(role: ResearchReaderRole) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
  }
  return { accessible: true as const, data: await getResearchDashboardData() };
}

export async function aiListResearchRecommendations(
  role: ResearchReaderRole,
  limit = 30,
) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiListResearchCompetitors(role: ResearchReaderRole, limit = 40) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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
      skus: { select: { currentPrice: true, name: true } },
      _count: { select: { skus: true, alerts: true } },
    },
  });
  return {
    accessible: true as const,
    count: rows.length,
    note: "Ringkasan harga per kompetitor. Untuk per-SKU lengkap pakai get_research_competitor atau analyze_competitor_pricing.",
    items: rows.map((r) => {
      const priceSummary = summarizeSkuPrices(r.skus);
      return {
        id: r.id,
        name: r.name,
        brand: r.brand,
        category: r.category,
        marketplace: r.marketplace,
        shopUrl: r.shopUrl,
        isActive: r.isActive,
        skuCount: r._count.skus,
        alertCount: r._count.alerts,
        priceSummary,
        updatedAt: iso(r.updatedAt),
      };
    }),
  };
}

export async function aiGetResearchCompetitor(role: ResearchReaderRole, competitorId: string) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiListReviewIntelSources(role: ResearchReaderRole, limit = 40) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiGetReviewIntelSource(role: ResearchReaderRole, sourceId: string) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiListTrendDigests(role: ResearchReaderRole, limit = 20) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiGetTrendDigest(role: ResearchReaderRole, digestId: string) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiListKeywordQueries(role: ResearchReaderRole, limit = 30) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiGetKeywordQuery(role: ResearchReaderRole, queryId: string) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiListSocialMonitors(role: ResearchReaderRole, limit = 30) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiGetSocialMonitor(role: ResearchReaderRole, monitorId: string) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiListUspAnalyses(role: ResearchReaderRole, limit = 30) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiGetUspAnalysis(role: ResearchReaderRole, analysisId: string) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiListProductConcepts(role: ResearchReaderRole, limit = 40) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiGetProductConcept(role: ResearchReaderRole, conceptId: string) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiListProductDiscoveryQueries(role: ResearchReaderRole, limit = 30) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiGetProductDiscoveryQuery(role: ResearchReaderRole, queryId: string) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiListResearchReports(role: ResearchReaderRole, limit = 20) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

export async function aiGetResearchReport(role: ResearchReaderRole, reportId: string) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
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

/* -------------------------------------------------------------------------- */
/* Analisis komposit — pricing & perbandingan                                 */
/* -------------------------------------------------------------------------- */

export async function aiAnalyzeCompetitorPricing(
  role: ResearchReaderRole,
  opts: {
    productQuery?: string;
    competitorId?: string;
    activeOnly?: boolean;
    limit?: number;
  } = {},
) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
  }

  const query = opts.productQuery?.trim() ?? "";
  const activeOnly = opts.activeOnly !== false;
  const cap = Math.min(opts.limit ?? 50, 80);

  const competitors = await prisma.researchCompetitor.findMany({
    where: {
      ...(opts.competitorId ? { id: opts.competitorId } : {}),
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: opts.competitorId ? 1 : 40,
    include: {
      skus: { orderBy: { reviewCount: "desc" } },
      snapshots: {
        orderBy: { capturedAt: "desc" },
        take: 5,
        include: { sku: { select: { name: true } } },
      },
    },
  });

  const latestPromoBySku = new Map<
    string,
    { hasPromo: boolean; promoText: string | null }
  >();

  const competitorBlocks = competitors
    .map((c) => {
      latestPromoBySku.clear();
      for (const snap of c.snapshots) {
        if (snap.skuId && !latestPromoBySku.has(snap.skuId)) {
          latestPromoBySku.set(snap.skuId, {
            hasPromo: snap.hasPromo,
            promoText: snap.promoText,
          });
        }
      }

      const competitorMatches =
        !query ||
        textMatchesQuery(c.name, query) ||
        textMatchesQuery(c.brand, query) ||
        textMatchesQuery(c.category, query);

      const skusWithPromo = c.skus.map((s) => {
        const promo = latestPromoBySku.get(s.id);
        return {
          ...s,
          hasPromo: promo?.hasPromo ?? false,
          promoText: promo?.promoText ?? null,
        };
      });

      const matchedSkus = skusWithPromo.filter(
        (s) =>
          competitorMatches ||
          textMatchesQuery(s.name, query),
      );

      if (!competitorMatches && matchedSkus.length === 0) {
        return null;
      }

      const insights = buildCompetitorInsights(
        matchedSkus.map((s) => ({
          id: s.id,
          name: s.name,
          currentPrice: s.currentPrice,
          rating: s.rating,
          reviewCount: s.reviewCount,
          hasPromo: s.hasPromo,
        })),
        c.snapshots.map((snap) => ({
          skuId: snap.skuId,
          price: snap.price,
          capturedAt: snap.capturedAt,
        })),
      );

      return {
        competitorId: c.id,
        name: c.name,
        brand: c.brand,
        category: c.category,
        marketplace: c.marketplace,
        shopUrl: c.shopUrl,
        insights,
        skus: matchedSkus.slice(0, cap).map((s) => ({
          id: s.id,
          name: s.name,
          currentPrice: s.currentPrice,
          rating: s.rating,
          reviewCount: s.reviewCount,
          hasPromo: s.hasPromo,
          promoText: s.promoText,
          productUrl: s.productUrl,
          lastSeenAt: iso(s.lastSeenAt),
        })),
      };
    })
    .filter((b): b is NonNullable<typeof b> => b != null);

  const reviewSources = query
    ? await prisma.reviewIntelSource.findMany({
        where: {
          OR: [
            { productName: { contains: query, mode: "insensitive" } },
            { competitorBrand: { contains: query, mode: "insensitive" } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 15,
        select: {
          id: true,
          productName: true,
          competitorBrand: true,
          marketplace: true,
          productUrl: true,
          status: true,
          reviewCount: true,
          brand: { select: { name: true } },
        },
      })
    : [];

  const catalogProducts = query
    ? await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { category: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 15,
        select: {
          id: true,
          name: true,
          sku: true,
          category: true,
          currentStock: true,
          brand: { select: { name: true } },
        },
      })
    : [];

  const allPrices = competitorBlocks.flatMap((b) =>
    b.skus
      .map((s) => s.currentPrice)
      .filter((p): p is number => p != null && p > 0),
  );

  return {
    accessible: true as const,
    query: query || null,
    summary: {
      competitorCount: competitorBlocks.length,
      skuWithPriceCount: competitorBlocks.reduce(
        (n, b) => n + b.skus.filter((s) => s.currentPrice != null).length,
        0,
      ),
      marketMinPrice: allPrices.length ? Math.min(...allPrices) : null,
      marketMaxPrice: allPrices.length ? Math.max(...allPrices) : null,
      marketAvgPrice: allPrices.length
        ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length)
        : null,
    },
    competitors: competitorBlocks,
    trackedReviewProducts: reviewSources.map((s) => ({
      id: s.id,
      productName: s.productName,
      competitorBrand: s.competitorBrand,
      ourBrand: s.brand?.name ?? null,
      marketplace: s.marketplace,
      productUrl: s.productUrl,
      status: s.status,
      reviewCount: s.reviewCount,
      note: "Harga jual tidak disimpan di Review Intel — lihat marketplace URL atau Competitor Tracker SKU.",
    })),
    internalCatalogProducts: catalogProducts.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      brandName: p.brand.name,
      currentStock: p.currentStock,
      note: "Katalog inventori DCC tidak menyimpan harga jual marketplace — bandingkan dengan harga kompetitor di atas.",
    })),
    analysisHints: [
      "Harga kompetitor ada di skus[].currentPrice (IDR) dan insights per kompetitor.",
      "Jika user minta bandingkan produk sendiri: cek trackedReviewProducts + internalCatalogProducts, lalu bandingkan dengan competitors[].skus.",
      "Jangan bilang tidak ada harga jika skuWithPriceCount > 0.",
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Evaluasi proposal produk — multi-sumber Research Hub                     */
/* -------------------------------------------------------------------------- */

function extractClaimTerms(claims: string | undefined): string[] {
  if (!claims?.trim()) return [];
  const raw = claims
    .toLowerCase()
    .split(/[,;/]+|\s+dan\s+|\s+&\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
  return [...new Set(raw)];
}

function buildSearchTerms(productQuery: string, claims?: string): string[] {
  const terms = new Set<string>();
  const q = productQuery.trim().toLowerCase();
  if (q) terms.add(q);
  for (const c of extractClaimTerms(claims)) terms.add(c);
  // Sub-kata penting dari kategori umum
  for (const word of q.split(/\s+/)) {
    if (word.length >= 4) terms.add(word);
  }
  return [...terms];
}

function assessProposedPrice(
  proposed: number | undefined,
  marketMin: number | null,
  marketMax: number | null,
  marketAvg: number | null,
) {
  if (proposed == null || proposed <= 0) {
    return {
      proposedPrice: null,
      marketMin,
      marketMax,
      marketAvg,
      position: null as string | null,
      percentVsAvg: null as number | null,
      percentVsMin: null as number | null,
      note: "Harga proposal tidak disertakan — bandingkan secara kualitatif.",
    };
  }
  if (marketAvg == null && marketMin == null) {
    return {
      proposedPrice: proposed,
      marketMin,
      marketMax,
      marketAvg,
      position: "unknown" as const,
      percentVsAvg: null,
      percentVsMin: null,
      note: "Belum ada benchmark harga kompetitor — validasi harga terbatas.",
    };
  }
  const avg = marketAvg ?? marketMin!;
  const pctVsAvg = Math.round(((proposed - avg) / avg) * 100);
  const pctVsMin =
    marketMin != null
      ? Math.round(((proposed - marketMin) / marketMin) * 100)
      : null;

  let position: string;
  if (marketMin != null && proposed < marketMin * 0.95) position = "below_market";
  else if (marketMax != null && proposed > marketMax * 1.05) position = "above_market";
  else if (pctVsAvg <= -15) position = "value_budget";
  else if (pctVsAvg >= 20) position = "premium";
  else position = "mid_market";

  return {
    proposedPrice: proposed,
    marketMin,
    marketMax,
    marketAvg,
    position,
    percentVsAvg: pctVsAvg,
    percentVsMin: pctVsMin,
    note:
      position === "value_budget"
        ? "Harga di bawah rata-rata pasar — menarik untuk entry, perhatikan margin & persepsi kualitas."
        : position === "premium"
          ? "Harga di atas rata-rata — perlu diferensiasi kuat (claim, ukuran, packaging)."
          : position === "below_market"
            ? "Harga paling murah vs kompetitor terlacak — agresif di harga."
            : position === "above_market"
              ? "Harga tertinggi vs kompetitor terlacak — risiko jika claim tidak unik."
              : "Harga sejajar pasar — kompetisi di claim, format, dan distribusi.",
  };
}

export async function aiEvaluateProductProposal(
  role: ResearchReaderRole,
  opts: {
    productQuery: string;
    proposedPrice?: number;
    claims?: string;
    sizeMl?: number;
    packagingNotes?: string;
  },
) {
  if (!canViewResearchHub(role)) {
    return denied("Akses Research Hub ditolak untuk peran ini.");
  }

  const productQuery = opts.productQuery.trim();
  if (!productQuery) {
    return denied("productQuery wajib diisi, mis. body lotion.");
  }

  const searchTerms = buildSearchTerms(productQuery, opts.claims);

  const [pricing, reviewSources, trendDigest, keywordQueries, uspAnalyses, recommendations, socialMonitors, discoveryQueries] =
    await Promise.all([
      aiAnalyzeCompetitorPricing(role, {
        productQuery,
        activeOnly: true,
        limit: 25,
      }),
      prisma.reviewIntelSource.findMany({
        where: {
          status: "READY",
          OR: searchTerms.flatMap((term) => [
            { productName: { contains: term, mode: "insensitive" as const } },
            { competitorBrand: { contains: term, mode: "insensitive" as const } },
          ]),
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: {
          summary: {
            select: {
              positivePct: true,
              negativePct: true,
              topComplaints: true,
              topPraises: true,
              gapOpportunity: true,
              aiActionPlan: true,
            },
          },
        },
      }),
      prisma.trendRadarDigest.findFirst({
        where: { status: "READY" },
        orderBy: { weekStart: "desc" },
        include: {
          items: {
            where: searchTerms.length
              ? {
                  OR: searchTerms.map((term) => ({
                    name: { contains: term, mode: "insensitive" as const },
                  })),
                }
              : undefined,
            take: 12,
            orderBy: { score: "desc" },
          },
        },
      }),
      prisma.keywordIntelQuery.findMany({
        where: {
          status: "READY",
          OR: [
            { category: { contains: productQuery, mode: "insensitive" } },
            { seedKeyword: { contains: productQuery, mode: "insensitive" } },
            ...searchTerms.map((term) => ({
              category: { contains: term, mode: "insensitive" as const },
            })),
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 3,
        include: {
          result: {
            select: {
              aiSummary: true,
              gapKeywords: true,
              namingSuggestions: true,
              copyKeywords: true,
            },
          },
        },
      }),
      prisma.uspGapAnalysis.findMany({
        where: {
          status: "READY",
          OR: [
            { category: { contains: productQuery, mode: "insensitive" } },
            ...searchTerms.map((term) => ({
              category: { contains: term, mode: "insensitive" as const },
            })),
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 3,
        include: {
          result: {
            select: {
              differentiationScore: true,
              aiSummary: true,
              gapMatrix: true,
              uspCandidates: true,
              categoryDecision: true,
            },
          },
        },
      }),
      prisma.researchRecommendation.findMany({
        where: {
          status: "OPEN",
          OR: searchTerms.map((term) => ({
            OR: [
              { module: { contains: term, mode: "insensitive" as const } },
              { action: { contains: term, mode: "insensitive" as const } },
              { rationale: { contains: term, mode: "insensitive" as const } },
            ],
          })),
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.socialListeningMonitor.findMany({
        where: { isActive: true },
        take: 5,
        include: {
          batches: {
            where: { status: "READY" },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              summary: {
                select: {
                  topPainPoints: true,
                  topWishlist: true,
                  aiSummary: true,
                },
              },
            },
          },
        },
      }),
      prisma.productDiscoveryQuery.findMany({
        where: {
          status: "READY",
          OR: searchTerms.flatMap((term) => [
            { keyword: { contains: term, mode: "insensitive" as const } },
          ]),
        },
        orderBy: { updatedAt: "desc" },
        take: 3,
        include: {
          products: {
            orderBy: [{ reviewCount: "desc" }, { soldCount: "desc" }],
            take: 15,
            select: {
              id: true,
              marketplace: true,
              name: true,
              shopName: true,
              price: true,
              rating: true,
              reviewCount: true,
              soldCount: true,
              hasPromo: true,
              promoText: true,
              categoryRank: true,
            },
          },
        },
      }),
    ]);

  const pricingData =
    pricing.accessible && "summary" in pricing ? pricing : null;
  const marketMin = pricingData?.summary?.marketMinPrice ?? null;
  const marketMax = pricingData?.summary?.marketMaxPrice ?? null;
  const marketAvg = pricingData?.summary?.marketAvgPrice ?? null;

  const pricingAssessment = assessProposedPrice(
    opts.proposedPrice,
    marketMin,
    marketMax,
    marketAvg,
  );

  const competitorSkuSamples =
    pricingData && "competitors" in pricingData
      ? (pricingData.competitors as { name: string; brand: string; skus: { name: string; currentPrice: number | null; rating: number | null }[] }[])
          .flatMap((c) =>
            c.skus
              .filter((s) => s.currentPrice != null)
              .slice(0, 3)
              .map((s) => ({
                competitor: c.name,
                brand: c.brand,
                skuName: s.name,
                price: s.currentPrice,
                rating: s.rating,
              })),
          )
          .slice(0, 15)
      : [];

  const reviewIntel = reviewSources.map((s) => ({
    id: s.id,
    productName: s.productName,
    competitorBrand: s.competitorBrand,
    marketplace: s.marketplace,
    reviewCount: s.reviewCount,
    sentiment: s.summary
      ? {
          positivePct: s.summary.positivePct,
          negativePct: s.summary.negativePct,
        }
      : null,
    topComplaints: s.summary?.topComplaints ?? null,
    topPraises: s.summary?.topPraises ?? null,
    gapOpportunity: s.summary?.gapOpportunity ?? null,
  }));

  const trends =
    trendDigest?.items.map((i) => ({
      name: i.name,
      dimension: i.dimension,
      phase: i.phase,
      score: i.score,
      narrative: i.narrative?.slice(0, 300) ?? null,
    })) ?? [];

  const keywords = keywordQueries.map((q) => ({
    id: q.id,
    category: q.category,
    seedKeyword: q.seedKeyword,
    aiSummary: q.result?.aiSummary?.slice(0, 400) ?? null,
    gapKeywords: q.result?.gapKeywords ?? null,
    namingSuggestions: q.result?.namingSuggestions ?? null,
  }));

  const uspGaps = uspAnalyses.map((a) => ({
    id: a.id,
    category: a.category,
    differentiationScore: a.result?.differentiationScore ?? null,
    aiSummary: a.result?.aiSummary?.slice(0, 400) ?? null,
    categoryDecision: a.result?.categoryDecision ?? null,
    uspCandidates: a.result?.uspCandidates ?? null,
  }));

  const socialInsights = socialMonitors
    .map((m) => {
      const summary = m.batches[0]?.summary;
      if (!summary) return null;
      return {
        monitorName: m.name,
        keywords: m.keywords,
        topPainPoints: summary.topPainPoints,
        topWishlist: summary.topWishlist,
        aiSummary: summary.aiSummary?.slice(0, 300) ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  type DiscoveryInsightsShape = {
    priceStats?: { min: number; max: number; avg: number; median: number } | null;
    priceBands?: { label: string; min: number; max: number; count: number }[];
    velocity?: {
      avgSold?: number;
      topSellers?: { name: string; soldCount: number; price: number | null }[];
    };
    promoShare?: number;
    valueLeaders?: { name: string; rating: number; price: number }[];
  };

  const productDiscovery = discoveryQueries.map((q) => {
    const insights = (q.aiInsights ?? null) as DiscoveryInsightsShape | null;
    const topProducts = q.products.slice(0, 10).map((p) => ({
      id: p.id,
      marketplace: p.marketplace,
      name: p.name,
      shopName: p.shopName,
      price: p.price,
      rating: p.rating,
      reviewCount: p.reviewCount,
      soldCount: p.soldCount,
      hasPromo: p.hasPromo,
      categoryRank: p.categoryRank,
    }));
    const priced = topProducts.filter((p) => p.price != null && p.price > 0);
    const discoveryMin =
      insights?.priceStats?.min ??
      (priced.length > 0 ? Math.min(...priced.map((p) => p.price!)) : null);
    const discoveryMax =
      insights?.priceStats?.max ??
      (priced.length > 0 ? Math.max(...priced.map((p) => p.price!)) : null);
    const discoveryAvg =
      insights?.priceStats?.avg ??
      (priced.length > 0
        ? Math.round(
            priced.reduce((sum, p) => sum + p.price!, 0) / priced.length,
          )
        : null);

    return {
      id: q.id,
      keyword: q.keyword,
      marketplaces: q.marketplaces,
      productCount: q.productCount,
      itemCount: q.products.length,
      priceStats:
        discoveryMin != null
          ? {
              min: discoveryMin,
              max: discoveryMax,
              avg: discoveryAvg,
              median: insights?.priceStats?.median ?? null,
            }
          : null,
      priceBands: insights?.priceBands?.slice(0, 5) ?? null,
      promoShare: insights?.promoShare ?? null,
      velocity: insights?.velocity
        ? {
            avgSold: insights.velocity.avgSold ?? null,
            topSellers: insights.velocity.topSellers?.slice(0, 5) ?? null,
          }
        : null,
      valueLeaders: insights?.valueLeaders?.slice(0, 5) ?? null,
      aiActionPlan: q.aiActionPlan,
      topProducts,
    };
  });

  const discoveryPricedCount = productDiscovery.reduce(
    (sum, d) => sum + d.topProducts.filter((p) => p.price != null).length,
    0,
  );

  const dataSourcesChecked = [
    {
      module: "competitor-tracker",
      status:
        (pricingData?.summary?.skuWithPriceCount ?? 0) > 0
          ? "found"
          : (pricingData?.summary?.competitorCount ?? 0) > 0
            ? "partial"
            : "empty",
      recordCount: pricingData?.summary?.competitorCount ?? 0,
      detail: `${pricingData?.summary?.skuWithPriceCount ?? 0} SKU berharga, ${pricingData?.summary?.competitorCount ?? 0} kompetitor`,
    },
    {
      module: "review-intelligence",
      status: reviewIntel.length > 0 ? "found" : "empty",
      recordCount: reviewIntel.length,
      detail: `${reviewIntel.length} sumber review siap analisis`,
    },
    {
      module: "trend-radar",
      status: trends.length > 0 ? "found" : trendDigest ? "partial" : "empty",
      recordCount: trends.length,
      detail: trends.length
        ? `${trends.length} tren relevan di digest terbaru`
        : "Tidak ada tren cocok di digest terbaru",
    },
    {
      module: "keyword-intel",
      status: keywords.length > 0 ? "found" : "empty",
      recordCount: keywords.length,
      detail: `${keywords.length} analisis keyword`,
    },
    {
      module: "usp-analyzer",
      status: uspGaps.length > 0 ? "found" : "empty",
      recordCount: uspGaps.length,
      detail: `${uspGaps.length} analisis USP/gap`,
    },
    {
      module: "social-listening",
      status: socialInsights.length > 0 ? "found" : "empty",
      recordCount: socialInsights.length,
      detail: `${socialInsights.length} monitor dengan insight`,
    },
    {
      module: "research-recommendations",
      status: recommendations.length > 0 ? "found" : "empty",
      recordCount: recommendations.length,
      detail: `${recommendations.length} rekomendasi terbuka`,
    },
    {
      module: "product-discovery",
      status: productDiscovery.length > 0 ? "found" : "empty",
      recordCount: productDiscovery.length,
      detail:
        productDiscovery.length > 0
          ? `${productDiscovery.length} query discovery · ${discoveryPricedCount} produk berharga di sample`
          : "Tidak ada query Product Discovery READY yang cocok dengan kata kunci",
    },
  ];

  const hasEnoughData =
    (pricingData?.summary?.skuWithPriceCount ?? 0) > 0 ||
    reviewIntel.length > 0 ||
    trends.length > 0 ||
    discoveryPricedCount > 0;

  return {
    accessible: true as const,
    proposal: {
      productQuery,
      proposedPrice: opts.proposedPrice ?? null,
      claims: opts.claims ?? null,
      sizeMl: opts.sizeMl ?? null,
      packagingNotes: opts.packagingNotes ?? null,
      searchTermsUsed: searchTerms,
    },
    dataSourcesChecked,
    pricingAssessment,
    competitorTracker: {
      summary: pricingData?.summary ?? null,
      topSkuByPrice: competitorSkuSamples,
      competitors:
        pricingData && "competitors" in pricingData
          ? (pricingData.competitors as unknown[]).slice(0, 5)
          : [],
    },
    reviewIntelligence: reviewIntel,
    trendRadar: {
      digestWeek: trendDigest
        ? { weekStart: iso(trendDigest.weekStart), weekEnd: iso(trendDigest.weekEnd) }
        : null,
      items: trends,
    },
    keywordIntel: keywords,
    uspAnalyzer: uspGaps,
    socialListening: socialInsights,
    productDiscovery,
    openRecommendations: recommendations.map((r) => ({
      module: r.module,
      priority: r.priority,
      action: r.action,
      rationale: r.rationale.slice(0, 300),
    })),
    evaluationGuidance: {
      hasEnoughData,
      mustAddress: [
        "Posisi harga proposal vs min/max/avg kompetitor (Competitor Tracker)",
        "Landscape marketplace dari Product Discovery (price band, top seller, promo) jika tersedia",
        "Apakah claim (mis. instant whitening) didukung atau contradicted oleh keluhan/praise di Review Intel",
        "Celah pasar dari gapOpportunity review & USP analyzer",
        "Tren naik/turun di kategori terkait",
        "Kesimpulan: make sense / make sense dengan catatan / kurang make sense — dengan bukti angka",
      ],
      verdictHints: [
        pricingAssessment.position === "value_budget"
          ? "Harga agresif — cocok jika claim kuat & margin OK"
          : null,
        pricingAssessment.position === "premium"
          ? "Harga premium — perlu bukti diferensiasi dari review/tren"
          : null,
        reviewIntel.some((r) => r.gapOpportunity)
          ? "Ada gap opportunity dari review kompetitor — manfaatkan di positioning"
          : null,
        productDiscovery.some((d) => d.priceStats != null)
          ? "Ada benchmark harga dari scrape marketplace (Product Discovery) — bandingkan dengan proposal"
          : null,
      ].filter(Boolean),
    },
  };
}

import "server-only";

import { prisma } from "@/lib/prisma";
import {
  computeDominantPaletteFromAssets,
  listBrandVisualAssets,
} from "@/lib/brand-research/visual";
import { buildVisualTrendAnalytics } from "@/lib/brand-research/visual-trend-analytics";
import type { BrandStrategyEvidenceInput } from "@/lib/brand-research/strategy/prompts/brand-strategy";
import type {
  DemoFlag,
  RepresentativeQuote,
  StrategyGenerationConfig,
  StructuredSourceRef,
} from "@/lib/brand-research/strategy/evidence-types";
import { filterBrandVisualAssetsForStrategy } from "@/lib/brand-research/strategy/strategy-visual-filter";
import {
  buildVisualSourceRefs,
  type StrategyVisualCatalog,
} from "@/lib/brand-research/strategy/strategy-visual-config";
import { getBrandPortfolio } from "@/lib/brand-research/portfolio/portfolio-service";
import { fetchProductDiscoveryEvidence } from "@/lib/brand-research/strategy/product-discovery-evidence";
import { fetchCompetitorProductEvidence } from "@/lib/research/evidence/competitor-product-evidence";
import type { PortfolioLineEvidence } from "@/lib/brand-research/strategy/evidence-types";

function idFilter(ids: string[]) {
  return ids.length > 0 ? { id: { in: ids } } : {};
}

function truncateQuote(text: string, max = 220): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

async function fetchReviewQuotes(sourceIds: string[]): Promise<RepresentativeQuote[]> {
  if (sourceIds.length === 0) return [];

  const [negative, positive] = await Promise.all([
    prisma.reviewRaw.findMany({
      where: {
        sourceId: { in: sourceIds },
        analysis: { sentiment: "NEGATIVE" },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { sourceId: true, text: true },
    }),
    prisma.reviewRaw.findMany({
      where: {
        sourceId: { in: sourceIds },
        analysis: { sentiment: "POSITIVE" },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { sourceId: true, text: true },
    }),
  ]);

  return [
    ...negative.map((r) => ({
      source: "review" as const,
      sourceId: r.sourceId,
      text: truncateQuote(r.text),
      sentiment: "negative" as const,
    })),
    ...positive.map((r) => ({
      source: "review" as const,
      sourceId: r.sourceId,
      text: truncateQuote(r.text),
      sentiment: "positive" as const,
    })),
  ];
}

async function fetchSocialQuotes(monitorIds: string[]): Promise<RepresentativeQuote[]> {
  if (monitorIds.length === 0) return [];

  const batches = await prisma.socialListeningBatch.findMany({
    where: {
      monitorId: { in: monitorIds },
      status: "READY",
    },
    orderBy: { createdAt: "desc" },
    distinct: ["monitorId"],
    select: { id: true, monitorId: true },
  });

  const batchIds = batches.map((b) => b.id);
  if (batchIds.length === 0) return [];

  const [pains, praises] = await Promise.all([
    prisma.socialMention.findMany({
      where: {
        batchId: { in: batchIds },
        OR: [
          { painPoint: { not: null } },
          { classification: { in: ["COMPLAINT", "QUESTION"] } },
        ],
      },
      orderBy: { likes: "desc" },
      take: 4,
      select: { batchId: true, text: true, painPoint: true },
    }),
    prisma.socialMention.findMany({
      where: {
        batchId: { in: batchIds },
        classification: { in: ["PRAISE", "RECOMMENDATION", "WISHLIST"] },
      },
      orderBy: { likes: "desc" },
      take: 4,
      select: { batchId: true, text: true },
    }),
  ]);

  const monitorByBatch = new Map(batches.map((b) => [b.id, b.monitorId]));

  return [
    ...pains.map((m) => ({
      source: "social" as const,
      sourceId: monitorByBatch.get(m.batchId) ?? m.batchId,
      text: truncateQuote(m.painPoint ?? m.text),
      sentiment: "negative" as const,
    })),
    ...praises.map((m) => ({
      source: "social" as const,
      sourceId: monitorByBatch.get(m.batchId) ?? m.batchId,
      text: truncateQuote(m.text),
      sentiment: "positive" as const,
    })),
  ];
}

function extractPromoThemes(promoTexts: string[]): string[] {
  const themes: string[] = [];
  for (const raw of promoTexts) {
    const t = raw?.trim();
    if (!t || t.length < 8) continue;
    themes.push(t.slice(0, 120));
  }
  return [...new Set(themes)].slice(0, 6);
}

export async function gatherStrategyEvidence(
  userId: string,
  ownerBrandId: string | null,
  config: StrategyGenerationConfig,
  visualCatalog: StrategyVisualCatalog,
  opts?: {
    category?: string;
    pmBrief?: string;
    demoFlags?: DemoFlag[];
  },
): Promise<BrandStrategyEvidenceInput> {
  const brandQs = ownerBrandId
    ? `?brandId=${encodeURIComponent(ownerBrandId)}`
    : "";

  const sourceRefs: StructuredSourceRef[] = [];

  const brandName = ownerBrandId
    ? (
        await prisma.brand.findUnique({
          where: { id: ownerBrandId },
          select: { name: true },
        })
      )?.name
    : undefined;

  const portfolio = ownerBrandId ? await getBrandPortfolio(ownerBrandId) : null;
  const portfolioLines: PortfolioLineEvidence[] =
    portfolio?.lines.map((line) => ({
      lineId: line.id,
      name: line.name,
      category: line.category ?? null,
      description: line.description ?? null,
      targetAudience: line.targetAudience ?? null,
      role: line.role ?? null,
      productDiscoveryQueryId: line.productDiscoveryQueryId ?? null,
      linkedDiscoveryKeyword: line.productDiscoveryLabel?.split(" (")[0] ?? null,
    })) ?? [];

  if (portfolio) {
    sourceRefs.push({
      module: "brand-portfolio",
      sourceId: portfolio.id,
      label: `Portfolio: ${portfolio.lines.length} lini produk`,
      href: `/brand-hub/portfolio${brandQs}`,
    });
    for (const line of portfolioLines) {
      sourceRefs.push({
        module: "brand-portfolio",
        sourceId: line.lineId,
        label: `Lini: ${line.name}`,
        href: `/brand-hub/portfolio${brandQs}`,
      });
    }
  }

  const reviewSources = config.review.enabled
    ? await prisma.reviewIntelSource.findMany({
        where: {
          status: "READY",
          ...idFilter(config.review.ids),
        },
        include: { summary: true },
        take: 10,
      })
    : [];

  for (const s of reviewSources) {
    sourceRefs.push({
      module: "review-intelligence",
      sourceId: s.id,
      label: `${s.productName} (${s.competitorBrand})`,
      href: `/brand-hub/strategy${brandQs}`,
    });
  }

  const socialMonitors = config.social.enabled
    ? await prisma.socialListeningMonitor.findMany({
        where: {
          ...idFilter(config.social.ids),
        },
        include: {
          batches: {
            where: { status: "READY" },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { summary: true },
          },
        },
        take: 10,
      })
    : [];

  for (const m of socialMonitors) {
    if (m.batches[0]) {
      sourceRefs.push({
        module: "social-listening",
        sourceId: m.id,
        label: m.name,
        href: `/brand-hub/social-listening/${m.id}${brandQs}`,
      });
    }
  }

  const competitors = config.competitor.enabled
    ? await prisma.researchCompetitor.findMany({
        where: {
          ...idFilter(config.competitor.ids),
        },
        include: {
          skus: {
            take: 8,
            orderBy: { reviewCount: "desc" },
            include: {
              snapshots: {
                orderBy: { capturedAt: "desc" },
                take: 1,
                select: { promoText: true, rating: true },
              },
            },
          },
        },
        take: 10,
      })
    : [];

  for (const c of competitors) {
    sourceRefs.push({
      module: "competitor-tracker",
      sourceId: c.id,
      label: `${c.brand} — ${c.name}`,
      href: `/brand-hub/competitor-tracker/${c.id}${brandQs}`,
    });
  }

  const keywordIds = config.keyword.ids;
  const [researchKeywordQueries, brandKeywordQueries] = config.keyword.enabled
    ? await Promise.all([
        prisma.keywordIntelQuery.findMany({
          where: {
            status: "READY",
            ...idFilter(keywordIds),
          },
          include: { result: true },
          take: 10,
        }),
        prisma.brandKeywordQuery.findMany({
          where: {
            status: "READY",
            ...idFilter(keywordIds),
          },
          include: { result: true },
          take: 10,
        }),
      ])
    : [[], []];

  for (const q of researchKeywordQueries) {
    sourceRefs.push({
      module: "keyword-intel",
      sourceId: q.id,
      label: `[Research] ${q.seedKeyword ?? q.category}`,
      href: `/research-hub/keyword-intel/${q.id}`,
    });
  }
  for (const q of brandKeywordQueries) {
    sourceRefs.push({
      module: "keyword-intel",
      sourceId: q.id,
      label: q.seedKeyword ?? q.category,
      href: `/brand-hub/keyword-intel/${q.id}${brandQs}`,
    });
  }

  const trendDigest = config.trend.enabled
    ? await prisma.trendRadarDigest.findFirst({
        where: {
          status: "READY",
          ...idFilter(config.trend.ids),
        },
        orderBy: { createdAt: "desc" },
        include: {
          items: { orderBy: { score: "desc" }, take: 10 },
        },
      })
    : null;

  if (trendDigest) {
    sourceRefs.push({
      module: "trend-radar",
      sourceId: trendDigest.id,
      label: trendDigest.isGlobal ? "Digest global" : "Digest brand",
      href: `/brand-hub/visual-trend${brandQs}`,
    });
  }

  const uspAnalyses = config.usp.enabled
    ? await prisma.uspGapAnalysis.findMany({
        where: {
          status: "READY",
          ...idFilter(config.usp.ids),
        },
        orderBy: { updatedAt: "desc" },
        include: { result: true },
        take: 10,
      })
    : [];

  for (const uspAnalysis of uspAnalyses) {
    sourceRefs.push({
      module: "usp-analyzer",
      sourceId: uspAnalysis.id,
      label: uspAnalysis.category,
      href: `/brand-hub/strategy${brandQs}`,
    });
  }

  const visualAssets = config.visual.enabled
    ? filterBrandVisualAssetsForStrategy(
        await listBrandVisualAssets(userId, ownerBrandId),
        config.visual,
      )
    : [];
  if (visualAssets.length > 0) {
    sourceRefs.push(...buildVisualSourceRefs(config.visual, visualCatalog, brandQs));
  }

  const visualTrendAnalytics = await buildVisualTrendAnalytics(userId, ownerBrandId);
  const visualTrendTags = [
    ...new Set(visualTrendAnalytics.flatMap((c) => c.topTags.map((t) => t.tag))),
  ].slice(0, 24);

  const visualTags = [
    ...new Set(
      visualAssets.flatMap((a) => [
        ...a.tags,
        ...a.aestheticTags,
        a.title ?? "",
      ]),
    ),
    ...visualTrendTags,
  ]
    .filter(Boolean)
    .slice(0, 50);

  const dominantPalette = computeDominantPaletteFromAssets(visualAssets);

  const reviewInsights = reviewSources.map((s) => {
    const complaints = Array.isArray(s.summary?.topComplaints)
      ? (s.summary!.topComplaints as { theme: string }[]).map((c) => c.theme)
      : [];
    const praises = Array.isArray(s.summary?.topPraises)
      ? (s.summary!.topPraises as { theme: string }[]).map((p) => p.theme)
      : [];
    return {
      sourceId: s.id,
      productName: s.productName,
      competitorBrand: s.competitorBrand,
      positivePct: s.summary?.positivePct ?? 0,
      negativePct: s.summary?.negativePct ?? 0,
      topComplaints: complaints.slice(0, 5),
      topPraises: praises.slice(0, 5),
      gapOpportunity: s.summary?.gapOpportunity ?? null,
    };
  });

  const socialInsights = socialMonitors
    .map((m) => {
      const summary = m.batches[0]?.summary;
      if (!summary) return null;
      const pains = Array.isArray(summary.topPainPoints)
        ? (summary.topPainPoints as { theme: string }[]).map((p) => p.theme)
        : [];
      const wish = Array.isArray(summary.topWishlist)
        ? (summary.topWishlist as { theme: string }[]).map((w) => w.theme)
        : [];
      return {
        sourceId: m.id,
        name: m.name,
        topPainPoints: pains.slice(0, 5),
        topWishlist: wish.slice(0, 5),
        aiSummary: summary.aiSummary,
      };
    })
    .filter(Boolean) as BrandStrategyEvidenceInput["socialInsights"];

  const keywordThemes = [
    ...researchKeywordQueries,
    ...brandKeywordQueries,
  ].flatMap((q) => {
    const matrix = Array.isArray(q.result?.keywordMatrix)
      ? (q.result!.keywordMatrix as { keyword: string }[])
      : [];
    return matrix.slice(0, 10).map((k) => k.keyword);
  });

  const trendSignals =
    trendDigest?.items.map((i) => ({
      sourceId: trendDigest.id,
      name: i.name,
      phase: i.phase,
      dimension: i.dimension,
      narrative: i.narrative,
    })) ?? [];

  let uspInsights: BrandStrategyEvidenceInput["uspInsights"] = [];
  for (const uspAnalysis of uspAnalyses) {
    if (!uspAnalysis.result) continue;
    const claimAnalysis = uspAnalysis.result.claimAnalysis as
      | { overused?: string[]; underserved?: string[] }
      | null;
    const candidates = Array.isArray(uspAnalysis.result.uspCandidates)
      ? (uspAnalysis.result.uspCandidates as { usp?: string }[])
          .map((c) => c.usp ?? "")
          .filter(Boolean)
          .slice(0, 5)
      : [];
    uspInsights.push({
      sourceId: uspAnalysis.id,
      category: uspAnalysis.category,
      uspCandidates: candidates,
      overusedClaims: claimAnalysis?.overused ?? [],
      underservedClaims: claimAnalysis?.underserved ?? [],
      aiSummary: uspAnalysis.result.aiSummary,
    });
  }

  const discoveryIds = new Set<string>();
  if (config.productDiscovery.enabled) {
    for (const id of config.productDiscovery.ids) discoveryIds.add(id);
  }
  for (const line of portfolioLines) {
    if (line.productDiscoveryQueryId) {
      discoveryIds.add(line.productDiscoveryQueryId);
    }
  }

  const productDiscoveryInsights = await fetchProductDiscoveryEvidence([
    ...discoveryIds,
  ]);

  for (const insight of productDiscoveryInsights) {
    sourceRefs.push({
      module: "product-discovery",
      sourceId: insight.sourceId,
      label: `Discovery: ${insight.keyword}`,
      href: `/research-hub/product-discovery/${insight.sourceId}`,
    });
  }

  const competitorProductIds = config.competitorProduct.enabled
    ? config.competitorProduct.ids
    : [];
  const competitorProductInsights = await fetchCompetitorProductEvidence(
    competitorProductIds,
  );

  for (const insight of competitorProductInsights) {
    sourceRefs.push({
      module: "competitor-product",
      sourceId: insight.sourceId,
      label: `Produk: ${insight.categoryName}`,
      href: `/brand-hub/competitor-tracker/products/${insight.sourceId}${brandQs}`,
    });
  }

  const [reviewQuotes, socialQuotes] = await Promise.all([
    fetchReviewQuotes(reviewSources.map((s) => s.id)),
    fetchSocialQuotes(socialMonitors.map((m) => m.id)),
  ]);

  const competitorSignals = competitors.map((c) => {
    const promoTexts = c.skus
      .map((s) => s.snapshots[0]?.promoText)
      .filter((p): p is string => Boolean(p));
    const ratings = c.skus
      .map((s) => s.rating ?? s.snapshots[0]?.rating)
      .filter((r): r is number => typeof r === "number");
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;

    return {
      sourceId: c.id,
      brand: c.brand,
      name: c.name,
      skuCount: c.skus.length,
      avgRating,
      positioningThemes: extractPromoThemes(promoTexts),
    };
  });

  return {
    category: opts?.category,
    pmBrief: opts?.pmBrief,
    brandName,
    portfolioSummary: portfolio?.summary ?? null,
    portfolioLines,
    demoFlags: opts?.demoFlags ?? [],
    sourceRefs,
    reviewInsights,
    socialInsights,
    representativeQuotes: [...reviewQuotes, ...socialQuotes].slice(0, 12),
    visualTags,
    visualTrendTags,
    dominantPalette,
    visualAssetCount: visualAssets.length,
    visualImageAnalysis: undefined,
    competitorSignals,
    keywordThemes,
    trendSignals,
    uspInsights,
    productDiscoveryInsights,
    competitorProductInsights,
  };
}

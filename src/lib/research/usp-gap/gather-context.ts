import "server-only";

import { prisma } from "@/lib/prisma";

export type ContextModules = {
  reviewIntel?: boolean;
  competitor?: boolean;
  trendRadar?: boolean;
  keywordIntel?: boolean;
  socialListening?: boolean;
};

export type UspGatheredContext = {
  category: string;
  reviewIntel: {
    topComplaints: { theme: string; count: number }[];
    topPraises: { theme: string; count: number }[];
    gapOpportunity: string | null;
  } | null;
  competitor: {
    brands: string[];
    skuNames: string[];
    priceRange: { min: number; max: number } | null;
    claims: string[];
  } | null;
  trendRadar: {
    items: { name: string; phase: string; dimension: string; narrative: string | null }[];
  } | null;
  keywordIntel: {
    gapKeywords: { keyword: string; volume: number; reason: string }[];
    clusters: { name: string; keywords: string[] }[];
    aiSummary: string | null;
  } | null;
  socialListening: {
    topPainPoints: { theme: string; count: number }[];
    topWishlist: { theme: string; count: number }[];
    aiSummary: string | null;
  } | null;
};

function categoryMatch(haystack: string, category: string): boolean {
  const h = haystack.toLowerCase();
  const c = category.toLowerCase();
  return h.includes(c) || c.split(/\s+/).some((w) => w.length > 2 && h.includes(w));
}

export async function gatherUspContext(input: {
  category: string;
  contextModules: ContextModules;
}): Promise<UspGatheredContext> {
  const { category, contextModules } = input;
  const ctx: UspGatheredContext = {
    category,
    reviewIntel: null,
    competitor: null,
    trendRadar: null,
    keywordIntel: null,
    socialListening: null,
  };

  if (contextModules.reviewIntel) {
    const sources = await prisma.reviewIntelSource.findMany({
      where: { status: "READY" },
      include: { summary: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    const matched = sources.filter(
      (s) =>
        categoryMatch(s.productName, category) ||
        categoryMatch(s.competitorBrand, category),
    );
    const pick = matched[0] ?? sources[0];

    if (pick?.summary) {
      ctx.reviewIntel = {
        topComplaints: Array.isArray(pick.summary.topComplaints)
          ? (pick.summary.topComplaints as { theme: string; count: number }[])
          : [],
        topPraises: Array.isArray(pick.summary.topPraises)
          ? (pick.summary.topPraises as { theme: string; count: number }[])
          : [],
        gapOpportunity: pick.summary.gapOpportunity,
      };
    }
  }

  if (contextModules.competitor) {
    const competitors = await prisma.researchCompetitor.findMany({
      include: {
        skus: { orderBy: { lastSeenAt: "desc" }, take: 30 },
      },
      orderBy: { updatedAt: "desc" },
      take: 15,
    });

    const matched = competitors.filter(
      (c) =>
        categoryMatch(c.name, category) ||
        categoryMatch(c.brand, category) ||
        c.skus.some((s) => categoryMatch(s.name, category)),
    );
    const picks = matched.length > 0 ? matched : competitors.slice(0, 5);

    const skuNames = picks.flatMap((c) => c.skus.map((s) => s.name));
    const prices = picks
      .flatMap((c) => c.skus.map((s) => s.currentPrice))
      .filter((p): p is number => typeof p === "number" && p > 0);

    const claims = skuNames
      .flatMap((name) => name.split(/[|\-–]/))
      .map((s) => s.trim())
      .filter((s) => s.length > 3)
      .slice(0, 30);

    ctx.competitor = {
      brands: [...new Set(picks.map((c) => c.brand))],
      skuNames: skuNames.slice(0, 25),
      priceRange:
        prices.length > 0
          ? { min: Math.min(...prices), max: Math.max(...prices) }
          : null,
      claims,
    };
  }

  if (contextModules.trendRadar) {
    const digest = await prisma.trendRadarDigest.findFirst({
      where: { status: "READY" },
      orderBy: { createdAt: "desc" },
      include: {
        items: { orderBy: { score: "desc" }, take: 15 },
      },
    });

    if (digest) {
      const items = digest.items
        .filter(
          (i) =>
            categoryMatch(i.name, category) ||
            categoryMatch(i.narrative ?? "", category),
        )
        .slice(0, 10);

      ctx.trendRadar = {
        items: (items.length > 0 ? items : digest.items.slice(0, 8)).map(
          (i) => ({
            name: i.name,
            phase: i.phase,
            dimension: i.dimension,
            narrative: i.narrative,
          }),
        ),
      };
    }
  }

  if (contextModules.keywordIntel) {
    const queries = await prisma.keywordIntelQuery.findMany({
      where: { status: "READY" },
      include: { result: true },
      orderBy: { updatedAt: "desc" },
      take: 15,
    });

    const matched =
      queries.find((q) => categoryMatch(q.category, category)) ?? queries[0];

    if (matched?.result) {
      ctx.keywordIntel = {
        gapKeywords: Array.isArray(matched.result.gapKeywords)
          ? (matched.result.gapKeywords as {
              keyword: string;
              volume: number;
              reason: string;
            }[])
          : [],
        clusters: Array.isArray(matched.result.clusters)
          ? (matched.result.clusters as { name: string; keywords: string[] }[])
          : [],
        aiSummary: matched.result.aiSummary,
      };
    }
  }

  if (contextModules.socialListening) {
    const batch = await prisma.socialListeningBatch.findFirst({
      where: { status: "READY" },
      orderBy: { collectedAt: "desc" },
      include: {
        summary: true,
        monitor: true,
      },
    });

    if (batch?.summary) {
      const monitorMatch =
        batch.monitor.keywords.some((k) => categoryMatch(k, category)) ||
        categoryMatch(batch.monitor.name, category);

      if (monitorMatch || !ctx.socialListening) {
        ctx.socialListening = {
          topPainPoints: Array.isArray(batch.summary.topPainPoints)
            ? (batch.summary.topPainPoints as { theme: string; count: number }[])
            : [],
          topWishlist: Array.isArray(batch.summary.topWishlist)
            ? (batch.summary.topWishlist as { theme: string; count: number }[])
            : [],
          aiSummary: batch.summary.aiSummary,
        };
      }
    }
  }

  return ctx;
}

export type AvailableContextModules = {
  reviewIntel: boolean;
  competitor: boolean;
  trendRadar: boolean;
  keywordIntel: boolean;
  socialListening: boolean;
};

export async function getAvailableContextModules(): Promise<AvailableContextModules> {
  const [reviews, competitors, trends, keywords, social] = await Promise.all([
    prisma.reviewIntelSource.count({ where: { status: "READY" } }),
    prisma.researchCompetitor.count(),
    prisma.trendRadarDigest.count({ where: { status: "READY" } }),
    prisma.keywordIntelQuery.count({ where: { status: "READY" } }),
    prisma.socialListeningBatch.count({ where: { status: "READY" } }),
  ]);

  return {
    reviewIntel: reviews > 0,
    competitor: competitors > 0,
    trendRadar: trends > 0,
    keywordIntel: keywords > 0,
    socialListening: social > 0,
  };
}

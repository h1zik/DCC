import "server-only";

import { prisma } from "@/lib/prisma";
import { categoryMatch } from "@/lib/research/usp-gap/category-match";
import type {
  ContextModules,
  ResolvedContextSources,
  ResolvedSourceRef,
} from "@/lib/research/usp-gap/context-types";

export type { ContextModules, ResolvedContextSources } from "@/lib/research/usp-gap/context-types";

export type UspGatheredContext = {
  category: string;
  reviewIntel: {
    topComplaints: { theme: string; count: number }[];
    topPraises: { theme: string; count: number }[];
    gapOpportunity: string | null;
    sourceProducts: string[];
  } | null;
  competitor: {
    brands: string[];
    skuNames: string[];
    priceRange: { min: number; max: number } | null;
    claims: string[];
  } | null;
  trendRadar: {
    items: {
      name: string;
      phase: string;
      dimension: string;
      narrative: string | null;
    }[];
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

export type GatherUspContextResult = {
  context: UspGatheredContext;
  resolvedSources: ResolvedContextSources;
};

export type AvailableContextModules = {
  reviewIntel: boolean;
  competitor: boolean;
  trendRadar: boolean;
  keywordIntel: boolean;
  socialListening: boolean;
};

function mergeThemes(
  lists: { theme: string; count: number }[][],
): { theme: string; count: number }[] {
  const map = new Map<string, number>();
  for (const list of lists) {
    for (const item of list) {
      if (!item.theme) continue;
      map.set(item.theme, (map.get(item.theme) ?? 0) + (item.count || 1));
    }
  }
  return [...map.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

function parseThemes(raw: unknown): { theme: string; count: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is { theme: string; count: number } =>
      typeof x === "object" &&
      x != null &&
      "theme" in x &&
      typeof (x as { theme: unknown }).theme === "string",
  );
}

export async function gatherUspContext(input: {
  category: string;
  contextModules: ContextModules;
}): Promise<GatherUspContextResult> {
  const { category, contextModules } = input;
  const ctx: UspGatheredContext = {
    category,
    reviewIntel: null,
    competitor: null,
    trendRadar: null,
    keywordIntel: null,
    socialListening: null,
  };
  const resolvedSources: ResolvedContextSources = {};

  if (contextModules.reviewIntel) {
    const explicitIds = contextModules.reviewSourceIds?.filter(Boolean) ?? [];

    let sources = explicitIds.length
      ? await prisma.reviewIntelSource.findMany({
          where: { id: { in: explicitIds }, status: "READY" },
          include: { summary: true },
        })
      : [];

    if (sources.length === 0) {
      const all = await prisma.reviewIntelSource.findMany({
        where: { status: "READY" },
        include: { summary: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      });
      const matched = all.filter(
        (s) =>
          categoryMatch(s.productName, category) ||
          categoryMatch(s.competitorBrand, category),
      );
      sources = (matched.length > 0 ? matched : all).slice(0, 5);
    }

    const withSummary = sources.filter((s) => s.summary);
    if (withSummary.length > 0) {
      resolvedSources.reviewIntel = withSummary.map(
        (s): ResolvedSourceRef => ({
          id: s.id,
          label: s.productName,
          meta: s.competitorBrand,
          href: `/research-hub/review-intelligence/${s.id}`,
        }),
      );

      ctx.reviewIntel = {
        topComplaints: mergeThemes(
          withSummary.map((s) => parseThemes(s.summary!.topComplaints)),
        ),
        topPraises: mergeThemes(
          withSummary.map((s) => parseThemes(s.summary!.topPraises)),
        ),
        gapOpportunity:
          withSummary.find((s) => s.summary?.gapOpportunity)?.summary
            ?.gapOpportunity ?? null,
        sourceProducts: withSummary.map(
          (s) => `${s.productName} (${s.competitorBrand})`,
        ),
      };
    }
  }

  if (contextModules.competitor) {
    const explicitIds = contextModules.competitorIds?.filter(Boolean) ?? [];

    let picks = explicitIds.length
      ? await prisma.researchCompetitor.findMany({
          where: { id: { in: explicitIds }, isActive: true },
          include: {
            skus: { orderBy: { lastSeenAt: "desc" }, take: 30 },
          },
        })
      : [];

    if (picks.length === 0) {
      const all = await prisma.researchCompetitor.findMany({
        where: { isActive: true },
        include: {
          skus: { orderBy: { lastSeenAt: "desc" }, take: 30 },
        },
        orderBy: { updatedAt: "desc" },
        take: 15,
      });
      const matched = all.filter(
        (c) =>
          categoryMatch(c.name, category) ||
          categoryMatch(c.brand, category) ||
          categoryMatch(c.category, category) ||
          c.skus.some((s) => categoryMatch(s.name, category)),
      );
      picks = (matched.length > 0 ? matched : all).slice(0, 5);
    }

    if (picks.length > 0) {
      resolvedSources.competitor = picks.map(
        (c): ResolvedSourceRef => ({
          id: c.id,
          label: c.name,
          meta: c.brand,
          href: `/research-hub/competitor-tracker/${c.id}`,
        }),
      );

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
  }

  if (contextModules.trendRadar) {
    const digest = contextModules.trendDigestId
      ? await prisma.trendRadarDigest.findFirst({
          where: {
            id: contextModules.trendDigestId,
            status: "READY",
          },
          include: {
            items: { orderBy: { score: "desc" }, take: 15 },
            watchlist: { select: { name: true } },
          },
        })
      : await prisma.trendRadarDigest.findFirst({
          where: { status: "READY" },
          orderBy: { createdAt: "desc" },
          include: {
            items: { orderBy: { score: "desc" }, take: 15 },
            watchlist: { select: { name: true } },
          },
        });

    if (digest) {
      const label = digest.isGlobal
        ? "Digest global"
        : (digest.watchlist?.name ?? "Watchlist");
      resolvedSources.trendRadar = {
        id: digest.id,
        label,
        meta: digest.generatedAt
          ? new Date(digest.generatedAt).toLocaleDateString("id-ID")
          : undefined,
        href: `/research-hub/trend-radar/${digest.id}`,
      };

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
    const query = contextModules.keywordQueryId
      ? await prisma.keywordIntelQuery.findFirst({
          where: {
            id: contextModules.keywordQueryId,
            status: "READY",
          },
          include: { result: true },
        })
      : await prisma.keywordIntelQuery.findMany({
          where: { status: "READY" },
          include: { result: true },
          orderBy: { updatedAt: "desc" },
          take: 15,
        }).then(
          (queries) =>
            queries.find((q) => categoryMatch(q.category, category)) ??
            queries[0] ??
            null,
        );

    if (query?.result) {
      resolvedSources.keywordIntel = {
        id: query.id,
        label: query.category,
        meta: query.seedKeyword ?? "—",
        href: `/research-hub/keyword-intel/${query.id}`,
      };

      ctx.keywordIntel = {
        gapKeywords: Array.isArray(query.result.gapKeywords)
          ? (query.result.gapKeywords as {
              keyword: string;
              volume: number;
              reason: string;
              koiScore?: number;
              confidence?: string;
            }[])
          : [],
        clusters: Array.isArray(query.result.clusters)
          ? (query.result.clusters as { name: string; keywords: string[] }[])
          : [],
        aiSummary: query.result.aiSummary,
      };
    }
  }

  if (contextModules.socialListening) {
    const monitorId = contextModules.socialMonitorId;

    const batch = monitorId
      ? await prisma.socialListeningBatch.findFirst({
          where: { monitorId, status: "READY" },
          orderBy: { collectedAt: "desc" },
          include: { summary: true, monitor: true },
        })
      : await prisma.socialListeningBatch.findFirst({
          where: { status: "READY" },
          orderBy: { collectedAt: "desc" },
          include: { summary: true, monitor: true },
        });

    if (batch?.summary) {
      const useBatch =
        !monitorId ||
        batch.monitor.keywords.some((k) => categoryMatch(k, category)) ||
        categoryMatch(batch.monitor.name, category) ||
        categoryMatch(category, batch.monitor.name);

      if (useBatch) {
        resolvedSources.socialListening = {
          id: batch.monitorId,
          label: batch.monitor.name,
          meta: batch.monitor.keywords.slice(0, 3).join(", "),
          href: `/research-hub/social-listening/${batch.monitorId}`,
        };

        ctx.socialListening = {
          topPainPoints: Array.isArray(batch.summary.topPainPoints)
            ? (batch.summary.topPainPoints as {
                theme: string;
                count: number;
              }[])
            : [],
          topWishlist: Array.isArray(batch.summary.topWishlist)
            ? (batch.summary.topWishlist as { theme: string; count: number }[])
            : [],
          aiSummary: batch.summary.aiSummary,
        };
      }
    }
  }

  return { context: ctx, resolvedSources };
}

export async function getAvailableContextModules(): Promise<AvailableContextModules> {
  const [reviews, competitors, trends, keywords, social] = await Promise.all([
    prisma.reviewIntelSource.count({ where: { status: "READY" } }),
    prisma.researchCompetitor.count({ where: { isActive: true } }),
    prisma.trendRadarDigest.count({ where: { status: "READY" } }),
    prisma.keywordIntelQuery.count({ where: { status: "READY" } }),
    prisma.socialListeningMonitor.count({ where: { isActive: true } }),
  ]);

  return {
    reviewIntel: reviews > 0,
    competitor: competitors > 0,
    trendRadar: trends > 0,
    keywordIntel: keywords > 0,
    socialListening: social > 0,
  };
}

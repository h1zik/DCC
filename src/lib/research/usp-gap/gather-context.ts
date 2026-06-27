import "server-only";

import { prisma } from "@/lib/prisma";
import { categoryMatch } from "@/lib/research/usp-gap/category-match";
import { fetchCompetitorProductEvidence } from "@/lib/research/evidence/competitor-product-evidence";
import {
  fetchProductDiscoveryEvidence,
  type ProductDiscoveryEvidence,
} from "@/lib/research/evidence/product-discovery-evidence";
import type {
  CompetitorProductEvidence,
} from "@/lib/research/evidence/competitor-product-evidence";
import type {
  ContextMatchQuality,
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
  productDiscovery: ProductDiscoveryEvidence[] | null;
  competitorProducts: CompetitorProductEvidence[] | null;
};

export type GatherUspContextResult = {
  context: UspGatheredContext;
  resolvedSources: ResolvedContextSources;
  /** Per-module: did the attached data match the category, or was it a
   * cross-category fallback (most-recent records used when no match found). */
  matchQuality: ContextMatchQuality;
};

export type AvailableContextModules = {
  reviewIntel: boolean;
  competitor: boolean;
  trendRadar: boolean;
  keywordIntel: boolean;
  socialListening: boolean;
  productDiscovery: boolean;
  competitorProducts: boolean;
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

/** Commerce/regulatory filler and size tokens that are NOT product claims. */
const CLAIM_NOISE = new Set([
  "free", "gift", "ori", "original", "promo", "ready", "stock", "termurah",
  "murah", "diskon", "new", "best", "seller", "terlaris", "bonus", "gratis",
  "isi", "value", "paket", "official", "store", "bpom", "cod", "pcs", "pack",
  "sachet", "resmi", "asli", "terbaru", "grosir", "reseller", "preorder",
  "bundle", "limited", "edition", "varian", "size", "pcs", "buy",
]);

/**
 * Extract tentative claim tokens from competitor SKU titles. Marketplace
 * titles are noisy ("Serum 30ml BPOM Ready Stock Promo"), so we drop size /
 * quantity / commerce-filler fragments and keep only meaningful phrases. These
 * are still only *signals* from titles, not verified claims.
 */
function extractClaimTokens(skuNames: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of skuNames) {
    for (const rawPart of name.split(/[|\-–—/,()[\]]+/)) {
      const part = rawPart.trim();
      if (part.length <= 3) continue;
      const lower = part.toLowerCase();
      // Skip size/quantity fragments (start with a digit, or "30ml"/"100 gr").
      if (/^\d/.test(lower)) continue;
      if (/\b\d+\s?(ml|gr|gram|g|kg|pcs|pack|sachet)\b/.test(lower)) continue;
      const words = lower.split(/\s+/).filter(Boolean);
      const meaningful = words.filter(
        (w) => w.length > 2 && !CLAIM_NOISE.has(w),
      );
      if (meaningful.length === 0) continue;
      if (seen.has(lower)) continue;
      seen.add(lower);
      out.push(part);
      if (out.length >= 30) return out;
    }
  }
  return out;
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
    productDiscovery: null,
    competitorProducts: null,
  };
  const resolvedSources: ResolvedContextSources = {};
  const matchQuality: ContextMatchQuality = {};

  if (contextModules.reviewIntel) {
    const explicitIds = contextModules.reviewSourceIds?.filter(Boolean) ?? [];

    let usedFallback = false;
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
      usedFallback = matched.length === 0;
      sources = (matched.length > 0 ? matched : all).slice(0, 5);
    }

    const withSummary = sources.filter((s) => s.summary);
    if (withSummary.length > 0) {
      matchQuality.reviewIntel = usedFallback ? "fallback" : "matched";
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

    let usedFallback = false;
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
      usedFallback = matched.length === 0;
      picks = (matched.length > 0 ? matched : all).slice(0, 5);
    }

    if (picks.length > 0) {
      matchQuality.competitor = usedFallback ? "fallback" : "matched";
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

      const claims = extractClaimTokens(skuNames);

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

      // No category-matching trend items → we fall back to arbitrary top items.
      matchQuality.trendRadar = items.length === 0 ? "fallback" : "matched";

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
    let usedFallback = false;
    let query;
    if (contextModules.keywordQueryId) {
      query = await prisma.keywordIntelQuery.findFirst({
        where: { id: contextModules.keywordQueryId, status: "READY" },
        include: { result: true },
      });
    } else {
      const queries = await prisma.keywordIntelQuery.findMany({
        where: { status: "READY" },
        include: { result: true },
        orderBy: { updatedAt: "desc" },
        take: 15,
      });
      const matched = queries.find((q) => categoryMatch(q.category, category));
      query = matched ?? queries[0] ?? null;
      usedFallback = !matched && !!query;
    }

    if (query?.result) {
      matchQuality.keywordIntel = usedFallback ? "fallback" : "matched";
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
        // Without an explicit monitor we took the latest batch regardless of
        // category — relevance to this category is not guaranteed.
        matchQuality.socialListening = monitorId ? "matched" : "fallback";
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

  if (contextModules.productDiscovery) {
    const explicitIds =
      contextModules.productDiscoveryQueryIds?.filter(Boolean) ?? [];

    let usedFallback = false;
    let queryIds = explicitIds;

    if (queryIds.length === 0) {
      const all = await prisma.productDiscoveryQuery.findMany({
        where: { status: "READY" },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, keyword: true },
      });
      const matched = all.filter((q) => categoryMatch(q.keyword, category));
      usedFallback = matched.length === 0;
      queryIds = (matched.length > 0 ? matched : all).slice(0, 3).map((q) => q.id);
    }

    if (queryIds.length > 0) {
      const insights = await fetchProductDiscoveryEvidence(queryIds);
      if (insights.length > 0) {
        matchQuality.productDiscovery = usedFallback ? "fallback" : "matched";
        resolvedSources.productDiscovery = insights.map(
          (q): ResolvedSourceRef => ({
            id: q.sourceId,
            label: q.keyword,
            meta: `${q.productCount} produk`,
            href: `/research-hub/product-discovery/${q.sourceId}`,
          }),
        );
        ctx.productDiscovery = insights;
      }
    }
  }

  if (contextModules.competitorProducts) {
    const explicitIds =
      contextModules.competitorProductCategoryIds?.filter(Boolean) ?? [];

    let usedFallback = false;
    let categoryIds = explicitIds;

    if (categoryIds.length === 0) {
      const all = await prisma.competitorProductCategory.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, name: true },
      });
      const matched = all.filter((c) => categoryMatch(c.name, category));
      usedFallback = matched.length === 0;
      categoryIds = (matched.length > 0 ? matched : all)
        .slice(0, 3)
        .map((c) => c.id);
    }

    if (categoryIds.length > 0) {
      const insights = await fetchCompetitorProductEvidence(categoryIds);
      if (insights.length > 0) {
        matchQuality.competitorProducts = usedFallback ? "fallback" : "matched";
        resolvedSources.competitorProducts = insights.map(
          (c): ResolvedSourceRef => ({
            id: c.sourceId,
            label: c.categoryName,
            meta: `${c.trackCount} produk`,
            href: `/research-hub/competitor-tracker/products/${c.sourceId}`,
          }),
        );
        ctx.competitorProducts = insights;
      }
    }
  }

  return { context: ctx, resolvedSources, matchQuality };
}

export async function getAvailableContextModules(): Promise<AvailableContextModules> {
  const [reviews, competitors, trends, keywords, social, discovery, productCats] =
    await Promise.all([
    prisma.reviewIntelSource.count({ where: { status: "READY" } }),
    prisma.researchCompetitor.count({ where: { isActive: true } }),
    prisma.trendRadarDigest.count({ where: { status: "READY" } }),
    prisma.keywordIntelQuery.count({ where: { status: "READY" } }),
    prisma.socialListeningMonitor.count({ where: { isActive: true } }),
    prisma.productDiscoveryQuery.count({ where: { status: "READY" } }),
    prisma.competitorProductCategory.count({ where: { isActive: true } }),
  ]);

  return {
    reviewIntel: reviews > 0,
    competitor: competitors > 0,
    trendRadar: trends > 0,
    keywordIntel: keywords > 0,
    socialListening: social > 0,
    productDiscovery: discovery > 0,
    competitorProducts: productCats > 0,
  };
}

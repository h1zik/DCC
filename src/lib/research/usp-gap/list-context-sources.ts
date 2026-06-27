import "server-only";

import { prisma } from "@/lib/prisma";
import { categoryMatch } from "@/lib/research/usp-gap/category-match";
import type {
  ContextModules,
  StoredContextModules,
  SuggestedContextSourceIds,
  UspContextSourceOptions,
} from "@/lib/research/usp-gap/context-types";

export function parseContextModules(raw: unknown): ContextModules {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;

  const reviewSourceIds = Array.isArray(o.reviewSourceIds)
    ? o.reviewSourceIds.filter((x): x is string => typeof x === "string")
    : undefined;

  const competitorIds = Array.isArray(o.competitorIds)
    ? o.competitorIds.filter((x): x is string => typeof x === "string")
    : undefined;

  const productDiscoveryQueryIds = Array.isArray(o.productDiscoveryQueryIds)
    ? o.productDiscoveryQueryIds.filter((x): x is string => typeof x === "string")
    : undefined;

  const competitorProductCategoryIds = Array.isArray(o.competitorProductCategoryIds)
    ? o.competitorProductCategoryIds.filter((x): x is string => typeof x === "string")
    : undefined;

  return {
    reviewIntel: !!o.reviewIntel,
    competitor: !!o.competitor,
    trendRadar: !!o.trendRadar,
    keywordIntel: !!o.keywordIntel,
    socialListening: !!o.socialListening,
    productDiscovery: !!o.productDiscovery,
    competitorProducts: !!o.competitorProducts,
    reviewSourceIds,
    competitorIds,
    trendDigestId:
      typeof o.trendDigestId === "string" ? o.trendDigestId : undefined,
    keywordQueryId:
      typeof o.keywordQueryId === "string" ? o.keywordQueryId : undefined,
    socialMonitorId:
      typeof o.socialMonitorId === "string" ? o.socialMonitorId : undefined,
    productDiscoveryQueryIds,
    competitorProductCategoryIds,
  };
}

export function parseStoredContextModules(raw: unknown): StoredContextModules {
  const base = parseContextModules(raw);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;

  const stored: StoredContextModules = { ...base };

  const resolved = o.resolvedSources;
  if (resolved && typeof resolved === "object") {
    stored.resolvedSources = resolved as StoredContextModules["resolvedSources"];
  }

  const matchQuality = o.matchQuality;
  if (matchQuality && typeof matchQuality === "object") {
    stored.matchQuality = matchQuality as StoredContextModules["matchQuality"];
  }

  return stored;
}

export async function listUspContextSourceOptions(): Promise<UspContextSourceOptions> {
  const [
    reviewSources,
    competitors,
    trendDigests,
    keywordQueries,
    socialMonitors,
    productDiscoveryQueries,
    competitorProductCategories,
  ] = await Promise.all([
      prisma.reviewIntelSource.findMany({
        where: { status: "READY" },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          productName: true,
          competitorBrand: true,
          reviewCount: true,
        },
      }),
      prisma.researchCompetitor.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: { id: true, name: true, brand: true, category: true },
      }),
      prisma.trendRadarDigest.findMany({
        where: { status: "READY" },
        orderBy: { generatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          isGlobal: true,
          generatedAt: true,
          watchlist: { select: { name: true } },
        },
      }),
      prisma.keywordIntelQuery.findMany({
        where: { status: "READY" },
        orderBy: { updatedAt: "desc" },
        take: 30,
        select: {
          id: true,
          category: true,
          seedKeyword: true,
          updatedAt: true,
        },
      }),
      prisma.socialListeningMonitor.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, name: true, keywords: true },
      }),
      prisma.productDiscoveryQuery.findMany({
        where: { status: "READY" },
        orderBy: { updatedAt: "desc" },
        take: 30,
        select: {
          id: true,
          keyword: true,
          productCount: true,
          marketplaces: true,
        },
      }),
      prisma.competitorProductCategory.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 30,
        select: {
          id: true,
          name: true,
          _count: { select: { tracks: { where: { isActive: true } } } },
        },
      }),
    ]);

  return {
    reviewSources: reviewSources.map((s) => ({
      id: s.id,
      label: s.productName,
      meta: `${s.competitorBrand} · ${s.reviewCount} review`,
    })),
    competitors: competitors.map((c) => ({
      id: c.id,
      label: c.name,
      meta: `${c.brand} · ${c.category}`,
    })),
    trendDigests: trendDigests.map((d) => ({
      id: d.id,
      label: d.isGlobal
        ? "Digest global"
        : (d.watchlist?.name ?? "Watchlist"),
      meta: d.generatedAt
        ? new Date(d.generatedAt).toLocaleDateString("id-ID")
        : "—",
    })),
    keywordQueries: keywordQueries.map((q) => ({
      id: q.id,
      label: q.category,
      meta: q.seedKeyword ?? "—",
    })),
    socialMonitors: socialMonitors.map((m) => ({
      id: m.id,
      label: m.name,
      meta: m.keywords.slice(0, 3).join(", ") || "—",
    })),
    productDiscoveryQueries: productDiscoveryQueries.map((q) => ({
      id: q.id,
      label: q.keyword,
      meta: `${q.productCount} produk · ${q.marketplaces.length} marketplace`,
    })),
    competitorProductCategories: competitorProductCategories.map((c) => ({
      id: c.id,
      label: c.name,
      meta: `${c._count.tracks} produk dilacak`,
    })),
  };
}

export async function suggestContextSourceIds(
  category: string,
): Promise<SuggestedContextSourceIds> {
  const options = await listUspContextSourceOptions();
  const trimmed = category.trim();
  if (!trimmed) {
    return {
      reviewSourceIds: [],
      competitorIds: [],
      trendDigestId: null,
      keywordQueryId: null,
      socialMonitorId: null,
      productDiscoveryQueryIds: [],
      competitorProductCategoryIds: [],
    };
  }

  const reviewSourceIds = options.reviewSources
    .filter(
      (s) =>
        categoryMatch(s.label, trimmed) || categoryMatch(s.meta, trimmed),
    )
    .slice(0, 5)
    .map((s) => s.id);

  const competitorIds = options.competitors
    .filter(
      (c) =>
        categoryMatch(c.label, trimmed) || categoryMatch(c.meta, trimmed),
    )
    .slice(0, 5)
    .map((c) => c.id);

  const keywordMatch = options.keywordQueries.find((q) =>
    categoryMatch(q.label, trimmed),
  );

  const socialMatch = options.socialMonitors.find(
    (m) =>
      categoryMatch(m.label, trimmed) || categoryMatch(m.meta, trimmed),
  );

  const productDiscoveryQueryIds = options.productDiscoveryQueries
    .filter((q) => categoryMatch(q.label, trimmed) || categoryMatch(q.meta, trimmed))
    .slice(0, 3)
    .map((q) => q.id);

  const competitorProductCategoryIds = options.competitorProductCategories
    .filter((c) => categoryMatch(c.label, trimmed) || categoryMatch(c.meta, trimmed))
    .slice(0, 3)
    .map((c) => c.id);

  return {
    reviewSourceIds,
    competitorIds,
    trendDigestId: options.trendDigests[0]?.id ?? null,
    keywordQueryId: keywordMatch?.id ?? options.keywordQueries[0]?.id ?? null,
    socialMonitorId: socialMatch?.id ?? options.socialMonitors[0]?.id ?? null,
    productDiscoveryQueryIds:
      productDiscoveryQueryIds.length > 0
        ? productDiscoveryQueryIds
        : options.productDiscoveryQueries.slice(0, 2).map((q) => q.id),
    competitorProductCategoryIds:
      competitorProductCategoryIds.length > 0
        ? competitorProductCategoryIds
        : options.competitorProductCategories.slice(0, 2).map((c) => c.id),
  };
}

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

  return {
    reviewIntel: !!o.reviewIntel,
    competitor: !!o.competitor,
    trendRadar: !!o.trendRadar,
    keywordIntel: !!o.keywordIntel,
    socialListening: !!o.socialListening,
    reviewSourceIds,
    competitorIds,
    trendDigestId:
      typeof o.trendDigestId === "string" ? o.trendDigestId : undefined,
    keywordQueryId:
      typeof o.keywordQueryId === "string" ? o.keywordQueryId : undefined,
    socialMonitorId:
      typeof o.socialMonitorId === "string" ? o.socialMonitorId : undefined,
  };
}

export function parseStoredContextModules(raw: unknown): StoredContextModules {
  const base = parseContextModules(raw);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const resolved = o.resolvedSources;
  if (!resolved || typeof resolved !== "object") return base;
  return { ...base, resolvedSources: resolved as StoredContextModules["resolvedSources"] };
}

export async function listBrandUspContextSourceOptions(): Promise<UspContextSourceOptions> {
  const [reviewSources, competitors, trendDigests, keywordQueries, socialMonitors] =
    await Promise.all([
      prisma.brandReviewSource.findMany({
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
      prisma.brandCompetitor.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 40,
        select: { id: true, name: true, brand: true, category: true },
      }),
      prisma.brandTrendDigest.findMany({
        where: { status: "READY" },
        orderBy: { generatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          isGlobal: true,
          generatedAt: true,
          ownerBrand: { select: { name: true } },
        },
      }),
      prisma.brandKeywordQuery.findMany({
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
      prisma.brandSocialMonitor.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, name: true, keywords: true },
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
        : (d.ownerBrand?.name ?? "Per brand"),
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
  };
}

export async function suggestBrandContextSourceIds(
  category: string,
): Promise<SuggestedContextSourceIds> {
  const options = await listBrandUspContextSourceOptions();
  const trimmed = category.trim();
  if (!trimmed) {
    return {
      reviewSourceIds: [],
      competitorIds: [],
      trendDigestId: null,
      keywordQueryId: null,
      socialMonitorId: null,
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

  return {
    reviewSourceIds,
    competitorIds,
    trendDigestId: options.trendDigests[0]?.id ?? null,
    keywordQueryId: keywordMatch?.id ?? options.keywordQueries[0]?.id ?? null,
    socialMonitorId: socialMatch?.id ?? options.socialMonitors[0]?.id ?? null,
  };
}

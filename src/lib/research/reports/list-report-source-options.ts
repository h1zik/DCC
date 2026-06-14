import "server-only";

import { prisma } from "@/lib/prisma";
import { getAvailableContextModules } from "@/lib/research/usp-gap/gather-context";

export type ReportSourceOption = { id: string; label: string; meta: string };

export type ReportSourceOptions = {
  reviewSources: ReportSourceOption[];
  competitors: ReportSourceOption[];
  digests: ReportSourceOption[];
  keywordQueries: ReportSourceOption[];
  socialMonitors: ReportSourceOption[];
  uspAnalyses: ReportSourceOption[];
  concepts: ReportSourceOption[];
};

export type ReportAvailableModules = {
  reviewIntel: boolean;
  competitor: boolean;
  trendRadar: boolean;
  keywordIntel: boolean;
  socialListening: boolean;
  uspAnalyzer: boolean;
  conceptLab: boolean;
};

export async function getReportAvailableModules(): Promise<ReportAvailableModules> {
  const [base, uspCount, conceptCount] = await Promise.all([
    getAvailableContextModules(),
    prisma.uspGapAnalysis.count({ where: { status: "READY" } }),
    prisma.productConcept.count({ where: { status: "READY" } }),
  ]);

  return {
    ...base,
    uspAnalyzer: uspCount > 0,
    conceptLab: conceptCount > 0,
  };
}

export async function listReportSourceOptions(): Promise<ReportSourceOptions> {
  const [
    reviewSources,
    competitors,
    digests,
    keywordQueries,
    socialMonitors,
    uspAnalyses,
    concepts,
  ] = await Promise.all([
    prisma.reviewIntelSource.findMany({
      where: { status: "READY" },
      select: {
        id: true,
        productName: true,
        competitorBrand: true,
        reviewCount: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.researchCompetitor.findMany({
      where: { isActive: true },
      select: { id: true, name: true, brand: true, category: true },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.trendRadarDigest.findMany({
      where: { status: "READY" },
      select: {
        id: true,
        isGlobal: true,
        generatedAt: true,
        watchlist: { select: { name: true } },
      },
      orderBy: { generatedAt: "desc" },
      take: 20,
    }),
    prisma.keywordIntelQuery.findMany({
      where: { status: "READY" },
      select: { id: true, category: true, seedKeyword: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.socialListeningMonitor.findMany({
      where: { isActive: true },
      select: { id: true, name: true, keywords: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.uspGapAnalysis.findMany({
      where: { status: "READY" },
      select: { id: true, category: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.productConcept.findMany({
      where: { status: "READY" },
      select: { id: true, title: true, category: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    reviewSources: reviewSources.map((r) => ({
      id: r.id,
      label: r.productName,
      meta: `${r.competitorBrand} · ${r.reviewCount} review`,
    })),
    competitors: competitors.map((c) => ({
      id: c.id,
      label: c.name,
      meta: `${c.brand} · ${c.category}`,
    })),
    digests: digests.map((d) => ({
      id: d.id,
      label: d.isGlobal
        ? "Digest global"
        : (d.watchlist?.name ?? "Watchlist"),
      meta: d.generatedAt
        ? new Date(d.generatedAt).toLocaleDateString("id-ID")
        : "—",
    })),
    keywordQueries: keywordQueries.map((k) => ({
      id: k.id,
      label: k.category,
      meta: k.seedKeyword ?? "—",
    })),
    socialMonitors: socialMonitors.map((m) => ({
      id: m.id,
      label: m.name,
      meta: m.keywords.slice(0, 3).join(", ") || "—",
    })),
    uspAnalyses: uspAnalyses.map((u) => ({
      id: u.id,
      label: u.category,
      meta: u.updatedAt.toLocaleDateString("id-ID"),
    })),
    concepts: concepts.map((c) => ({
      id: c.id,
      label: c.title,
      meta: c.category,
    })),
  };
}

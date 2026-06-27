import "server-only";

import { Prisma, SeoReportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ReportSection } from "@/lib/research/reports/types";
import {
  buildResearchAiStep,
  generateResearchText,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";

export type SeoReportMetrics = Record<string, number>;

type Aggregate = {
  metrics: SeoReportMetrics;
  rankProjects: { name: string; domain: string; keywords: number; avgPosition: number | null }[];
  topMovers: { keyword: string; from: number | null; to: number | null }[];
  audits: { url: string; score: number | null }[];
  crawls: { name: string; domain: string; issues: number; pagesCrawled: number }[];
};

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

async function aggregateSeoData(): Promise<Aggregate> {
  const [
    keywordProjects,
    trackedKeywords,
    rankAgg,
    technicalIssues,
    auditAgg,
    contentDrafts,
    marketplaceAnalyses,
    rankProjectsRaw,
    moversRaw,
    auditsRaw,
    crawlsRaw,
  ] = await Promise.all([
    prisma.seoKeywordProject.count(),
    prisma.seoTrackedKeyword.count(),
    prisma.seoTrackedKeyword.aggregate({
      _avg: { lastPosition: true },
      where: { lastPosition: { not: null } },
    }),
    prisma.seoCrawlIssue.count(),
    prisma.seoOnPageAudit.aggregate({
      _avg: { score: true },
      where: { score: { not: null } },
    }),
    prisma.seoContentDraft.count(),
    prisma.seoMarketplaceAnalysis.count(),
    prisma.seoRankProject.findMany({
      include: { keywords: { select: { lastPosition: true } } },
      take: 20,
    }),
    prisma.seoTrackedKeyword.findMany({
      where: { lastPosition: { not: null }, previousPosition: { not: null } },
      select: { keyword: true, lastPosition: true, previousPosition: true },
      take: 200,
    }),
    prisma.seoOnPageAudit.findMany({
      where: { status: "READY" },
      orderBy: { createdAt: "desc" },
      select: { url: true, score: true },
      take: 8,
    }),
    prisma.seoSiteCrawl.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { issues: true } } },
      take: 8,
    }),
  ]);

  const avgRank = rankAgg._avg.lastPosition;
  const avgScore = auditAgg._avg.score;

  const topMovers = moversRaw
    .map((m) => ({
      keyword: m.keyword,
      from: m.previousPosition,
      to: m.lastPosition,
      delta: num(m.previousPosition) - num(m.lastPosition),
    }))
    .filter((m) => m.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5)
    .map(({ keyword, from, to }) => ({ keyword, from, to }));

  return {
    metrics: {
      "Proyek keyword": keywordProjects,
      "Keyword dilacak": trackedKeywords,
      "Posisi rata-rata": avgRank != null ? Math.round(avgRank) : 0,
      "Isu teknis": technicalIssues,
      "Skor audit rata-rata": avgScore != null ? Math.round(avgScore) : 0,
      "Draft konten": contentDrafts,
      "Analisis marketplace": marketplaceAnalyses,
    },
    rankProjects: rankProjectsRaw.map((p) => {
      const positions = p.keywords
        .map((k) => k.lastPosition)
        .filter((v): v is number => v != null);
      return {
        name: p.name,
        domain: p.domain,
        keywords: p.keywords.length,
        avgPosition: positions.length
          ? Math.round(positions.reduce((s, v) => s + v, 0) / positions.length)
          : null,
      };
    }),
    topMovers,
    audits: auditsRaw.map((a) => ({ url: a.url, score: a.score })),
    crawls: crawlsRaw.map((c) => ({
      name: c.name,
      domain: c.domain,
      issues: c._count.issues,
      pagesCrawled: c.pagesCrawled,
    })),
  };
}

function rankSection(agg: Aggregate): ReportSection {
  const lines: string[] = [];
  lines.push(`Posisi rata-rata: **${agg.metrics["Posisi rata-rata"] || "—"}** dari ${agg.metrics["Keyword dilacak"]} keyword dilacak.`);
  if (agg.rankProjects.length) {
    lines.push("");
    for (const p of agg.rankProjects.slice(0, 8)) {
      lines.push(`- ${p.name} (${p.domain}): ${p.keywords} keyword, posisi rata-rata ${p.avgPosition ?? "—"}`);
    }
  }
  if (agg.topMovers.length) {
    lines.push("");
    lines.push("**Top movers (naik):**");
    for (const m of agg.topMovers) {
      lines.push(`- "${m.keyword}": ${m.from ?? "—"} → ${m.to ?? "—"}`);
    }
  }
  return { id: "rank", title: "Ranking & SERP", body: lines.join("\n"), moduleRef: "Rank Tracker" };
}

function technicalSection(agg: Aggregate): ReportSection {
  const lines: string[] = [];
  lines.push(`Skor audit on-page rata-rata: **${agg.metrics["Skor audit rata-rata"] || "—"}**. Total isu teknis: **${agg.metrics["Isu teknis"]}**.`);
  if (agg.audits.length) {
    lines.push("");
    lines.push("**Audit terbaru:**");
    for (const a of agg.audits) lines.push(`- ${a.url}: skor ${a.score ?? "—"}`);
  }
  if (agg.crawls.length) {
    lines.push("");
    lines.push("**Crawl terbaru:**");
    for (const c of agg.crawls) lines.push(`- ${c.domain}: ${c.pagesCrawled} halaman, ${c.issues} isu`);
  }
  return { id: "technical", title: "SEO Teknis", body: lines.join("\n"), moduleRef: "Audit & Crawler" };
}

function buildSections(type: SeoReportType, agg: Aggregate): ReportSection[] {
  switch (type) {
    case SeoReportType.RANK_TRACKING:
      return [rankSection(agg)];
    case SeoReportType.TECHNICAL:
      return [technicalSection(agg)];
    case SeoReportType.FULL:
      return [rankSection(agg), technicalSection(agg)];
    case SeoReportType.OVERVIEW:
    default:
      return [rankSection(agg), technicalSection(agg)];
  }
}

export async function generateSeoReport(reportId: string): Promise<void> {
  const report = await prisma.seoReport.findUnique({ where: { id: reportId } });
  if (!report) throw new Error("Laporan tidak ditemukan.");

  await prisma.seoReport.update({
    where: { id: reportId },
    data: { status: "ANALYZING", errorMessage: null },
  });

  try {
    const agg = await aggregateSeoData();
    const sections = buildSections(report.type, agg);

    let aiSummary: string | null = null;
    let aiMeta: object | undefined;
    try {
      aiSummary = await generateResearchText(
        `Kamu analis SEO. Tulis executive summary singkat (3-4 kalimat, Bahasa Indonesia) untuk laporan SEO brand kosmetik berdasarkan metrik ini:
${JSON.stringify(agg.metrics, null, 2)}
Soroti kondisi ranking dan isu teknis. Tanpa basa-basi pembuka.`,
        { tier: "flash" },
      );
      aiMeta = researchAiMetaFromSteps([
        buildResearchAiStep("SEO report summary", "flash"),
      ]) as object;
    } catch (err) {
      console.warn("[seo/reports] summary LLM gagal (diabaikan)", err);
    }

    await prisma.seoReport.update({
      where: { id: reportId },
      data: {
        status: "READY",
        sections: sections as unknown as Prisma.InputJsonValue,
        metrics: agg.metrics as unknown as Prisma.InputJsonValue,
        aiSummary: aiSummary?.trim() || null,
        aiMeta,
        errorMessage: null,
      },
    });
  } catch (err) {
    await prisma.seoReport.update({
      where: { id: reportId },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Gagal membuat laporan.",
      },
    });
    throw err;
  }
}

import "server-only";

import { Prisma, SeoReportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ReportSection } from "@/lib/research/reports/types";
import {
  buildResearchAiStep,
  generateResearchText,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import { hasRankHistory } from "@/lib/seo/rank-tracker/rank-change";

export type SeoReportMetrics = Record<string, number>;

type Aggregate = {
  /** Metrik hitungan untuk bar chart (hanya besaran "jumlah" yang sebanding). */
  metrics: SeoReportMetrics;
  /** Posisi rata-rata keyword yang ranking — metrik teks, bukan bar. */
  avgPosition: number | null;
  rankProjects: { name: string; domain: string; keywords: number; avgPosition: number | null }[];
  topMovers: { keyword: string; from: number | null; to: number | null; delta: number }[];
  audits: { url: string; score: number | null }[];
  crawls: { name: string; domain: string; issues: number; pagesCrawled: number }[];
};

const AVG_POSITION_LABEL = "Posisi rata-rata (keyword yang ranking)";

/** Rentang periode laporan (hari) menurut tipe: ringkasan/ranking mingguan, teknis/lengkap bulanan. */
export function reportPeriodDays(type: SeoReportType): number {
  switch (type) {
    case SeoReportType.TECHNICAL:
    case SeoReportType.FULL:
      return 30;
    case SeoReportType.RANK_TRACKING:
    case SeoReportType.OVERVIEW:
    default:
      return 7;
  }
}

/** Populasi rank tracker yang sama dengan dashboard: hanya proyek aktif. */
const ACTIVE_TRACKED = { project: { isActive: true } } as const;

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
    prisma.seoTrackedKeyword.count({ where: ACTIVE_TRACKED }),
    prisma.seoTrackedKeyword.aggregate({
      _avg: { lastPosition: true },
      where: { ...ACTIVE_TRACKED, lastPosition: { not: null } },
    }),
    prisma.seoCrawlIssue.count(),
    prisma.seoOnPageAudit.aggregate({
      _avg: { score: true },
      where: { score: { not: null } },
    }),
    prisma.seoContentDraft.count(),
    prisma.seoMarketplaceAnalysis.count(),
    prisma.seoRankProject.findMany({
      where: { isActive: true },
      include: { keywords: { select: { lastPosition: true } } },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    // Semua keyword aktif yang punya pembanding; diurutkan di JS berdasarkan |Δ|.
    prisma.seoTrackedKeyword.findMany({
      where: ACTIVE_TRACKED,
      select: {
        keyword: true,
        lastPosition: true,
        previousPosition: true,
        _count: { select: { snapshots: true } },
      },
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

  // Δ positif = naik. null (di luar top 100) dihitung sebagai 101, konsisten
  // dengan dashboard; keyword yang baru dicek sekali tidak punya pembanding.
  const topMovers = moversRaw
    .filter((m) =>
      hasRankHistory({
        previousPosition: m.previousPosition,
        snapshotCount: m._count.snapshots,
      }),
    )
    .map((m) => ({
      keyword: m.keyword,
      from: m.previousPosition,
      to: m.lastPosition,
      delta: (m.previousPosition ?? 101) - (m.lastPosition ?? 101),
    }))
    .filter((m) => m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 10);

  return {
    metrics: {
      "Proyek keyword": keywordProjects,
      "Keyword dilacak": trackedKeywords,
      "Isu teknis": technicalIssues,
      "Skor audit rata-rata": avgScore != null ? Math.round(avgScore) : 0,
      "Draft konten": contentDrafts,
      "Analisis marketplace": marketplaceAnalyses,
    },
    avgPosition: avgRank != null ? Math.round(avgRank * 10) / 10 : null,
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

function fmtPos(v: number | null): string {
  return v == null ? "100+" : `#${v}`;
}

function rankSection(agg: Aggregate): ReportSection {
  const lines: string[] = [];
  lines.push(
    `${AVG_POSITION_LABEL}: **${agg.avgPosition != null ? `#${agg.avgPosition}` : "—"}** dari ${agg.metrics["Keyword dilacak"]} keyword dilacak (proyek aktif).`,
  );
  if (agg.rankProjects.length) {
    lines.push("");
    for (const p of agg.rankProjects.slice(0, 8)) {
      lines.push(
        `- ${p.name} (${p.domain}): ${p.keywords} keyword, posisi rata-rata (keyword yang ranking) ${p.avgPosition != null ? `#${p.avgPosition}` : "—"}`,
      );
    }
  }
  const up = agg.topMovers.filter((m) => m.delta > 0).slice(0, 5);
  const down = agg.topMovers.filter((m) => m.delta < 0).slice(0, 5);
  if (up.length) {
    lines.push("");
    lines.push("**Top movers naik (vs cek sebelumnya):**");
    for (const m of up) {
      lines.push(`- "${m.keyword}": ${fmtPos(m.from)} → ${fmtPos(m.to)} (+${m.delta})`);
    }
  }
  if (down.length) {
    lines.push("");
    lines.push("**Top movers turun (vs cek sebelumnya):**");
    for (const m of down) {
      lines.push(`- "${m.keyword}": ${fmtPos(m.from)} → ${fmtPos(m.to)} (${m.delta})`);
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

    const periodEnd = new Date();
    const periodStart = new Date(
      periodEnd.getTime() - reportPeriodDays(report.type) * 24 * 60 * 60 * 1000,
    );

    let aiSummary: string | null = null;
    let aiMeta: object | undefined;
    try {
      aiSummary = await generateResearchText(
        `Kamu analis SEO. Tulis executive summary singkat (3-4 kalimat, Bahasa Indonesia) untuk laporan SEO brand kosmetik berdasarkan metrik ini:
${JSON.stringify(
  {
    ...agg.metrics,
    [AVG_POSITION_LABEL]: agg.avgPosition ?? "belum ada yang ranking",
  },
  null,
  2,
)}
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
        periodStart,
        periodEnd,
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

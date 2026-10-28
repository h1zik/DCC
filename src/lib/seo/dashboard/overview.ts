import "server-only";

import { prisma } from "@/lib/prisma";
import { visibilityBreakdown } from "@/lib/seo/rank-tracker/visibility";
import { topMovers, type Mover } from "@/lib/seo/rank-tracker/distribution";
import { hasRankHistory } from "@/lib/seo/rank-tracker/rank-change";
import { getMonthlySpend, type MonthlySpend } from "@/lib/seo/dataforseo/usage";
import { getGscDashboardSummary } from "@/lib/seo/gsc/sync";

/**
 * Aggregator dashboard SEO — kumpulkan metrik lintas modul dalam satu
 * Promise.all agar halaman tetap tipis.
 */

export type SeoDashboardData = {
  keywordCount: number;
  trackedCount: number;
  /** Posisi rata-rata keyword yang ranking saja (null bila belum ada yang ranking). */
  avgPosition: number | null;
  visibility: number;
  /** Keyword tanpa data volume (dibobot median pada visibility). */
  unknownVolumeCount: number;
  technicalIssues: number;
  latestHealthScore: number | null;
  avgAuditScore: number | null;
  contentPipeline: {
    ideas: number;
    briefs: number;
    drafts: number;
    published: number;
  };
  movers: { up: Mover[]; down: Mover[] };
  spend: MonthlySpend;
  gsc: {
    configured: boolean;
    clicks28: number;
    prevClicks28: number;
    impressions28: number;
    topQueries: { key: string; clicks: number }[];
  } | null;
};

export async function getSeoDashboardData(): Promise<SeoDashboardData> {
  const [
    keywordCount,
    trackedKeywords,
    technicalIssues,
    auditAgg,
    latestCrawl,
    ideaCount,
    briefCount,
    draftCount,
    publishedCount,
    spend,
    gsc,
  ] = await Promise.all([
    prisma.seoKeyword.count(),
    prisma.seoTrackedKeyword.findMany({
      where: { project: { isActive: true } },
      select: {
        keyword: true,
        lastPosition: true,
        previousPosition: true,
        searchVolume: true,
        _count: { select: { snapshots: true } },
      },
    }),
    prisma.seoCrawlIssue.count(),
    prisma.seoOnPageAudit.aggregate({
      _avg: { score: true },
      where: { score: { not: null } },
    }),
    prisma.seoSiteCrawl.findFirst({
      where: { status: "READY", healthScore: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { healthScore: true },
    }),
    prisma.seoContentOpportunity.count({ where: { stage: "IDEA" } }),
    prisma.seoContentBrief.count(),
    prisma.seoContentDraft.count(),
    prisma.seoContentOpportunity.count({ where: { stage: "PUBLISHED" } }),
    getMonthlySpend(),
    getGscDashboardSummary().catch(() => null),
  ]);

  const ranked = trackedKeywords.filter((k) => k.lastPosition != null);
  const avgPosition =
    ranked.length > 0
      ? Math.round(
          (ranked.reduce((s, k) => s + (k.lastPosition ?? 0), 0) / ranked.length) *
            10,
        ) / 10
      : null;

  const { score: visibility, unknownVolumeCount } = visibilityBreakdown(
    trackedKeywords.map((k) => ({
      position: k.lastPosition,
      searchVolume: k.searchVolume,
    })),
  );

  // Keyword yang baru dicek sekali belum punya pembanding — bukan mover.
  const movers = topMovers(
    trackedKeywords
      .filter((k) =>
        hasRankHistory({
          previousPosition: k.previousPosition,
          snapshotCount: k._count.snapshots,
        }),
      )
      .map((k) => ({
        keyword: k.keyword,
        previousPosition: k.previousPosition,
        currentPosition: k.lastPosition,
      })),
    5,
  );

  return {
    keywordCount,
    trackedCount: trackedKeywords.length,
    avgPosition,
    visibility,
    unknownVolumeCount,
    technicalIssues,
    latestHealthScore: latestCrawl?.healthScore ?? null,
    avgAuditScore:
      auditAgg._avg.score != null ? Math.round(auditAgg._avg.score) : null,
    contentPipeline: {
      ideas: ideaCount,
      briefs: briefCount,
      drafts: draftCount,
      published: publishedCount,
    },
    movers,
    spend,
    gsc,
  };
}

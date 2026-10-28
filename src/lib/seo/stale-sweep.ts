import "server-only";

import { SeoAnalysisStatus, SeoJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SEO_STALE_RUN_MESSAGE, SEO_STALE_RUN_MS } from "@/lib/seo/labels";

/** Job SEO (mis. sinkron rank tracker) RUNNING lebih lama dari ini → terhenti. */
const SEO_JOB_STALE_MS = 30 * 60 * 1000;

const BUSY: SeoAnalysisStatus[] = [
  SeoAnalysisStatus.PENDING,
  SeoAnalysisStatus.COLLECTING,
  SeoAnalysisStatus.ANALYZING,
];

export type StaleSweepResult = Record<string, number>;

/**
 * Tandai FAILED semua run SEO yang berstatus busy tetapi tidak bergerak selama
 * `SEO_STALE_RUN_MS`. Dipanggil dari cron `crawl-poll` (tiap 5 menit).
 *
 * Catatan per model:
 * - SeoSiteCrawl: hanya PENDING (belum punya task DataForSEO). Crawl yang
 *   sudah berjalan (COLLECTING/ANALYZING) punya timeout sendiri di crawler
 *   berdasarkan progres task, karena crawl besar memang bisa >15 menit.
 * - SeoContentDraft: status READY adalah default; hanya yang busy yang disapu,
 *   dan draft writer bisa di-resume, jadi pesan errornya berbeda.
 */
export async function failStaleSeoRuns(
  now: number = Date.now(),
): Promise<StaleSweepResult> {
  const cutoff = new Date(now - SEO_STALE_RUN_MS);
  const whereBusy = { status: { in: BUSY }, updatedAt: { lt: cutoff } };
  const data = {
    status: SeoAnalysisStatus.FAILED,
    errorMessage: SEO_STALE_RUN_MESSAGE,
  };

  const [
    keywordProjects,
    keywordGaps,
    domainOverviews,
    onPageAudits,
    pendingCrawls,
    contentBriefs,
    contentDrafts,
    contentAudits,
    aiVisibilityRuns,
    marketplaceAnalyses,
    reports,
    topicRuns,
    jobs,
  ] = await Promise.all([
    prisma.seoKeywordProject.updateMany({ where: whereBusy, data }),
    prisma.seoKeywordGap.updateMany({ where: whereBusy, data }),
    prisma.seoDomainOverview.updateMany({ where: whereBusy, data }),
    prisma.seoOnPageAudit.updateMany({ where: whereBusy, data }),
    prisma.seoSiteCrawl.updateMany({
      where: {
        status: SeoAnalysisStatus.PENDING,
        dataforseoTaskId: null,
        updatedAt: { lt: cutoff },
      },
      data,
    }),
    prisma.seoContentBrief.updateMany({ where: whereBusy, data }),
    prisma.seoContentDraft.updateMany({
      where: whereBusy,
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage:
          "Penulisan draft terhenti (kemungkinan server restart). Gunakan Lanjutkan untuk meneruskan dari bagian terakhir.",
      },
    }),
    prisma.seoContentAudit.updateMany({ where: whereBusy, data }),
    prisma.seoAiVisibilityRun.updateMany({ where: whereBusy, data }),
    prisma.seoMarketplaceAnalysis.updateMany({ where: whereBusy, data }),
    prisma.seoReport.updateMany({ where: whereBusy, data }),
    prisma.seoContentTopicRun.updateMany({ where: whereBusy, data }),
    prisma.seoJob.updateMany({
      where: {
        status: SeoJobStatus.RUNNING,
        OR: [
          { startedAt: { lt: new Date(now - SEO_JOB_STALE_MS) } },
          { startedAt: null, createdAt: { lt: new Date(now - SEO_JOB_STALE_MS) } },
        ],
      },
      data: {
        status: SeoJobStatus.FAILED,
        error: SEO_STALE_RUN_MESSAGE,
        completedAt: new Date(now),
      },
    }),
  ]);

  const result: StaleSweepResult = {
    keywordProjects: keywordProjects.count,
    keywordGaps: keywordGaps.count,
    domainOverviews: domainOverviews.count,
    onPageAudits: onPageAudits.count,
    pendingCrawls: pendingCrawls.count,
    contentBriefs: contentBriefs.count,
    contentDrafts: contentDrafts.count,
    contentAudits: contentAudits.count,
    aiVisibilityRuns: aiVisibilityRuns.count,
    marketplaceAnalyses: marketplaceAnalyses.count,
    reports: reports.count,
    topicRuns: topicRuns.count,
    jobs: jobs.count,
  };
  const total = Object.values(result).reduce((a, b) => a + b, 0);
  if (total > 0) {
    console.warn("[seo/stale-sweep] run macet ditandai FAILED", result);
  }
  return result;
}

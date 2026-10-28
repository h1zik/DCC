import { Bug } from "lucide-react";
import { Prisma, SeoAnalysisStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSeoStatusBusy } from "@/lib/seo/labels";
import { SeoModulePage } from "@/components/seo/seo-module-page";
import {
  CrawlerClient,
  type CrawlRow,
  type CrawlerSummary,
} from "./crawler-client";
import {
  CrawlScheduleSection,
  type CrawlScheduleRow,
} from "./crawl-schedule-section";

type IssueCountRow = {
  crawlId: string;
  pagesWithIssues: number | bigint;
  issueTypes: number | bigint;
};

/**
 * Hitungan isu per crawl dengan definisi yang sama seperti halaman detail:
 * "halaman bermasalah" = URL unik pada baris isu per-URL; "jenis isu" = baris
 * agregat. Menjumlahkan semua baris (agregat + per-URL) menghitung ganda.
 */
async function loadIssueCounts(
  crawlIds: string[],
): Promise<Map<string, { pagesWithIssues: number; issueTypes: number }>> {
  const map = new Map<string, { pagesWithIssues: number; issueTypes: number }>();
  if (crawlIds.length === 0) return map;
  const rows = await prisma.$queryRaw<IssueCountRow[]>`
    SELECT
      "crawlId",
      COUNT(DISTINCT "url") FILTER (WHERE "url" IS NOT NULL) AS "pagesWithIssues",
      COUNT(*) FILTER (WHERE "url" IS NULL) AS "issueTypes"
    FROM "SeoCrawlIssue"
    WHERE "crawlId" IN (${Prisma.join(crawlIds)})
    GROUP BY "crawlId"
  `;
  for (const r of rows) {
    map.set(r.crawlId, {
      pagesWithIssues: Number(r.pagesWithIssues),
      issueTypes: Number(r.issueTypes),
    });
  }
  return map;
}

export default async function SeoCrawlerPage() {
  const [crawls, schedules] = await Promise.all([
    prisma.seoSiteCrawl.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.seoCrawlSchedule.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const issueCounts = await loadIssueCounts(crawls.map((c) => c.id));

  const rows: CrawlRow[] = crawls.map((c) => {
    const counts = issueCounts.get(c.id);
    return {
      id: c.id,
      name: c.name,
      domain: c.domain,
      status: c.status,
      pagesCrawled: c.pagesCrawled,
      maxPages: c.maxPages,
      includeLighthouse: c.includeLighthouse,
      pagesWithIssues: counts?.pagesWithIssues ?? 0,
      issueTypes: counts?.issueTypes ?? 0,
      healthScore: c.healthScore,
      errorMessage: c.errorMessage,
      createdAt: c.createdAt.toISOString(),
    };
  });

  // Agregat ringkasan dari data yang sudah diambil (tanpa query tambahan).
  const latestReady =
    rows.find((r) => r.status === SeoAnalysisStatus.READY) ?? null;
  const summary: CrawlerSummary = {
    totalCrawls: rows.length,
    totalDomains: new Set(rows.map((r) => r.domain)).size,
    lastHealthScore: latestReady?.healthScore ?? null,
    lastReadyIssues: latestReady?.pagesWithIssues ?? null,
    runningCrawls: rows.filter((r) => isSeoStatusBusy(r.status)).length,
  };

  const scheduleRows: CrawlScheduleRow[] = schedules.map((s) => ({
    id: s.id,
    domain: s.domain,
    maxPages: s.maxPages,
    frequency: s.frequency,
    isActive: s.isActive,
    nextRunAt: s.nextRunAt.toISOString(),
    lastCrawlId: s.lastCrawlId,
  }));

  return (
    <SeoModulePage
      icon={Bug}
      title="Technical SEO Crawler"
      description="Crawl satu domain: broken link, redirect, status code, duplicate/missing meta, sitemap/robots, dan Core Web Vitals. Isu disusun berdasarkan prioritas — bisa dijadwalkan berulang."
    >
      <CrawlerClient crawls={rows} summary={summary} />
      <CrawlScheduleSection schedules={scheduleRows} />
    </SeoModulePage>
  );
}

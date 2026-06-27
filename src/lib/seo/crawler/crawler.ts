import "server-only";

import { Prisma, SeoAnalysisStatus, SeoIssueSeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DataForSeoError, isDataForSeoConfigured } from "@/lib/seo/dataforseo/client";
import {
  fetchLighthouseLive,
  fetchOnPagePages,
  fetchOnPageSummary,
  postOnPageCrawlTask,
  type CrawlPageRow,
  type LighthouseMetrics,
} from "@/lib/seo/dataforseo/onpage";
import { buildCrawlIssues } from "@/lib/seo/crawler/crawl-rules";

/** Batas waktu crawl sebelum dianggap gagal (2 jam). */
const CRAWL_TIMEOUT_MS = 2 * 60 * 60 * 1000;
/** Maksimum baris isu per-halaman yang disimpan. */
const MAX_PAGE_ISSUES = 200;

/** Mulai crawl: posting task DataForSEO On-Page. Dipanggil via after() saat create. */
export async function startSiteCrawl(crawlId: string): Promise<void> {
  const crawl = await prisma.seoSiteCrawl.findUnique({ where: { id: crawlId } });
  if (!crawl) throw new Error("Crawl tidak ditemukan.");

  if (!isDataForSeoConfigured()) {
    await prisma.seoSiteCrawl.update({
      where: { id: crawlId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage:
          "DataForSEO belum dikonfigurasi (set DATAFORSEO_LOGIN & DATAFORSEO_PASSWORD).",
      },
    });
    return;
  }

  try {
    const taskId = await postOnPageCrawlTask({
      target: crawl.domain,
      maxCrawlPages: crawl.maxPages,
    });
    await prisma.seoSiteCrawl.update({
      where: { id: crawlId },
      data: {
        status: SeoAnalysisStatus.COLLECTING,
        dataforseoTaskId: taskId,
        errorMessage: null,
        dataNotice: null,
      },
    });
  } catch (err) {
    const message =
      err instanceof DataForSeoError
        ? err.balanceExhausted
          ? "Saldo DataForSEO habis — tidak bisa memulai crawl."
          : err.message
        : err instanceof Error
          ? err.message
          : "Gagal memulai crawl.";
    await prisma.seoSiteCrawl.update({
      where: { id: crawlId },
      data: { status: SeoAnalysisStatus.FAILED, errorMessage: message },
    });
  }
}

/** Map status code halaman → isu URL-level. */
function pageStatusIssue(page: CrawlPageRow): {
  type: string;
  severity: SeoIssueSeverity;
  message: string;
} | null {
  const code = page.statusCode;
  if (code == null) return null;
  if (code >= 500)
    return { type: "is_5xx_code", severity: SeoIssueSeverity.CRITICAL, message: `Status ${code}` };
  if (code >= 400)
    return { type: "is_4xx_code", severity: SeoIssueSeverity.HIGH, message: `Status ${code}` };
  return null;
}

/** Bangun baris isu per-halaman (dibatasi MAX_PAGE_ISSUES, prioritas tinggi dulu). */
function buildPageIssueRows(
  crawlId: string,
  pages: CrawlPageRow[],
): Prisma.SeoCrawlIssueCreateManyInput[] {
  const rows: Prisma.SeoCrawlIssueCreateManyInput[] = [];
  for (const page of pages) {
    if (!page.url) continue;
    const status = pageStatusIssue(page);
    if (status) {
      rows.push({
        crawlId,
        type: status.type,
        severity: status.severity,
        url: page.url,
        message: status.message,
      });
    }
    if (page.checks.no_title || !page.title) {
      rows.push({
        crawlId,
        type: "no_title",
        severity: SeoIssueSeverity.HIGH,
        url: page.url,
        message: "Halaman tanpa title tag.",
      });
    }
    if (page.h1Count === 0) {
      rows.push({
        crawlId,
        type: "no_h1_tag",
        severity: SeoIssueSeverity.MEDIUM,
        url: page.url,
        message: "Halaman tanpa heading H1.",
      });
    }
    if (!page.description) {
      rows.push({
        crawlId,
        type: "no_description",
        severity: SeoIssueSeverity.MEDIUM,
        url: page.url,
        message: "Halaman tanpa meta description.",
      });
    }
  }
  // Prioritaskan severity tinggi saat memotong.
  const order: Record<SeoIssueSeverity, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFO: 4,
  };
  rows.sort((a, b) => order[a.severity] - order[b.severity]);
  return rows.slice(0, MAX_PAGE_ISSUES);
}

/** Ambil hasil crawl bila sudah selesai; update isu, summary, dan Lighthouse. */
export async function collectCrawlResults(crawlId: string): Promise<void> {
  const crawl = await prisma.seoSiteCrawl.findUnique({ where: { id: crawlId } });
  if (!crawl || !crawl.dataforseoTaskId) return;

  // Timeout: crawl menggantung terlalu lama.
  if (Date.now() - crawl.createdAt.getTime() > CRAWL_TIMEOUT_MS) {
    await prisma.seoSiteCrawl.update({
      where: { id: crawlId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage: "Crawl melebihi batas waktu (timeout).",
      },
    });
    return;
  }

  let summary;
  try {
    summary = await fetchOnPageSummary(crawl.dataforseoTaskId);
  } catch (err) {
    console.error("[seo/crawler] summary gagal", crawlId, err);
    return; // coba lagi pada poll berikutnya
  }
  if (!summary) return;

  // Update progress meski belum selesai.
  if (summary.crawlProgress !== "finished") {
    if (summary.pagesCrawled != null && summary.pagesCrawled !== crawl.pagesCrawled) {
      await prisma.seoSiteCrawl.update({
        where: { id: crawlId },
        data: { pagesCrawled: summary.pagesCrawled },
      });
    }
    return;
  }

  // Selesai → kumpulkan halaman + (opsional) Lighthouse.
  await prisma.seoSiteCrawl.update({
    where: { id: crawlId },
    data: { status: SeoAnalysisStatus.ANALYZING },
  });

  let pages: CrawlPageRow[] = [];
  try {
    pages = await fetchOnPagePages(crawl.dataforseoTaskId, crawl.maxPages);
  } catch (err) {
    console.warn("[seo/crawler] pages gagal (lanjut dengan agregat)", err);
  }

  let lighthouse: LighthouseMetrics | null = null;
  if (crawl.includeLighthouse) {
    try {
      lighthouse = await fetchLighthouseLive(`https://${crawl.domain}`);
    } catch (err) {
      console.warn("[seo/crawler] lighthouse gagal (diabaikan)", err);
    }
  }

  const aggregateIssues = buildCrawlIssues(summary).map((issue) => ({
    crawlId,
    type: issue.type,
    severity: issue.severity,
    count: issue.count,
    message: issue.message,
    url: null,
  }));
  const pageIssues = buildPageIssueRows(crawlId, pages);

  await prisma.$transaction([
    prisma.seoCrawlIssue.deleteMany({ where: { crawlId } }),
    prisma.seoCrawlIssue.createMany({ data: [...aggregateIssues, ...pageIssues] }),
    prisma.seoSiteCrawl.update({
      where: { id: crawlId },
      data: {
        status: SeoAnalysisStatus.READY,
        pagesCrawled: summary.pagesCrawled ?? pages.length,
        summary: summary as unknown as Prisma.InputJsonValue,
        lighthouse: lighthouse
          ? (lighthouse as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        errorMessage: null,
      },
    }),
  ]);
}

/** Poll semua crawl yang masih berjalan — dipanggil cron (`mode=crawl-poll`). */
export async function pollRunningSiteCrawls(): Promise<{
  checked: number;
  finished: number;
}> {
  const running = await prisma.seoSiteCrawl.findMany({
    where: {
      status: { in: [SeoAnalysisStatus.COLLECTING, SeoAnalysisStatus.ANALYZING] },
      dataforseoTaskId: { not: null },
    },
    select: { id: true },
  });

  let finished = 0;
  for (const crawl of running) {
    try {
      await collectCrawlResults(crawl.id);
      const updated = await prisma.seoSiteCrawl.findUnique({
        where: { id: crawl.id },
        select: { status: true },
      });
      if (updated?.status === SeoAnalysisStatus.READY) finished += 1;
    } catch (err) {
      console.error("[seo/crawler] poll gagal", crawl.id, err);
    }
  }
  return { checked: running.length, finished };
}

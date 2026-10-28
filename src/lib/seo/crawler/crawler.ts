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
  type CrawlSummary,
  type LighthouseMetrics,
} from "@/lib/seo/dataforseo/onpage";
import { buildCrawlIssues } from "@/lib/seo/crawler/crawl-rules";
import {
  diffCrawlIssues,
  type DiffableIssue,
} from "@/lib/seo/crawler/crawl-diff";
import { computeHealthScore } from "@/lib/seo/crawler/health-score";
import { notifyUser } from "@/lib/notify";
import { NotificationType } from "@prisma/client";

/** Batas waktu crawl (COLLECTING tanpa progres) sebelum dianggap gagal (2 jam). */
export const CRAWL_TIMEOUT_MS = 2 * 60 * 60 * 1000;
/**
 * Batas usia status ANALYZING. Pengumpulan hasil (pages + Lighthouse + tulis
 * DB) normalnya < 5 menit; lebih dari ini hampir pasti proses mati di tengah
 * jalan, sehingga baris dikembalikan ke COLLECTING agar poll berikutnya
 * mencoba lagi.
 */
export const ANALYZING_STALE_MS = 20 * 60 * 1000;
/** Maksimum baris isu per-halaman yang disimpan. */
const MAX_PAGE_ISSUES = 5_000;

export const CRAWL_NO_PAGES_MESSAGE =
  "Crawl tidak menghasilkan halaman (kemungkinan domain memblokir bot DataForSEO atau host salah).";
export const CRAWL_PAGES_UNAVAILABLE_NOTICE =
  "Daftar halaman DataForSEO gagal diambil: isu per-URL & inventaris halaman tidak diperbarui, dan perbandingan dengan crawl sebelumnya hanya memakai isu agregat.";
export const CRAWL_NO_METRICS_NOTICE =
  "Health score tidak dihitung: DataForSEO tidak mengirim metrik halaman untuk crawl ini.";

const PAGE_CHECK_RULES: Array<{
  key: string;
  severity: SeoIssueSeverity;
  message: string;
}> = [
  { key: "is_broken", severity: SeoIssueSeverity.HIGH, message: "Halaman tidak dapat diakses." },
  { key: "canonical_to_broken", severity: SeoIssueSeverity.HIGH, message: "Canonical mengarah ke halaman rusak." },
  { key: "no_title", severity: SeoIssueSeverity.HIGH, message: "Halaman tanpa title tag." },
  { key: "no_description", severity: SeoIssueSeverity.MEDIUM, message: "Halaman tanpa meta description." },
  { key: "no_h1_tag", severity: SeoIssueSeverity.MEDIUM, message: "Halaman tanpa heading H1." },
  { key: "high_loading_time", severity: SeoIssueSeverity.MEDIUM, message: "Waktu muat halaman tinggi." },
  { key: "recursive_canonical", severity: SeoIssueSeverity.MEDIUM, message: "Canonical rekursif/berantai." },
  { key: "canonical_chain", severity: SeoIssueSeverity.MEDIUM, message: "Canonical melewati rantai URL." },
  { key: "canonical_to_redirect", severity: SeoIssueSeverity.MEDIUM, message: "Canonical mengarah ke redirect." },
  { key: "title_too_long", severity: SeoIssueSeverity.LOW, message: "Title terlalu panjang." },
  { key: "title_too_short", severity: SeoIssueSeverity.LOW, message: "Title terlalu pendek." },
  { key: "no_image_alt", severity: SeoIssueSeverity.LOW, message: "Ada gambar tanpa alt text." },
  { key: "low_content_rate", severity: SeoIssueSeverity.LOW, message: "Rasio konten teks rendah." },
  { key: "large_page_size", severity: SeoIssueSeverity.LOW, message: "Ukuran halaman terlalu besar." },
  { key: "has_render_blocking_resources", severity: SeoIssueSeverity.LOW, message: "Ada resource yang memblok render." },
  { key: "has_links_to_redirects", severity: SeoIssueSeverity.LOW, message: "Halaman menautkan ke URL redirect." },
  { key: "is_orphan_page", severity: SeoIssueSeverity.LOW, message: "Halaman orphan tanpa internal link masuk." },
  { key: "no_content_encoding", severity: SeoIssueSeverity.LOW, message: "Respons tidak memakai kompresi konten." },
];

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

/**
 * True bila status task-level DataForSEO berarti task tidak akan pernah
 * menghasilkan ringkasan (mis. 40401 Task Not Found, 40000 Bad Request).
 * Status antre (40601/40602) dan 40402 "Task Handed" masih diproses; 5xxxx
 * dianggap transien dan diserahkan ke timeout.
 */
export function isTerminalTaskStatus(code: number | null): boolean {
  if (code == null) return false;
  if (code === 40601 || code === 40602 || code === 40402) return false;
  return code >= 40000 && code < 50000;
}

/** True bila ringkasan membawa metrik halaman yang bisa dinilai. */
export function hasPageMetrics(summary: CrawlSummary): boolean {
  const pm = summary.pageMetrics;
  if (!pm) return false;
  if (Object.keys(pm.checks ?? {}).length > 0) return true;
  return (
    pm.onpageScore != null ||
    pm.brokenLinks != null ||
    pm.brokenResources != null ||
    pm.duplicateTitle != null ||
    pm.duplicateDescription != null ||
    pm.duplicateContent != null ||
    pm.redirectLoop != null ||
    pm.nonIndexable != null ||
    pm.linksInternal != null ||
    pm.linksExternal != null
  );
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
    for (const rule of PAGE_CHECK_RULES) {
      if (page.checks[rule.key] !== true) continue;
      // Status 4xx/5xx sudah dicatat di atas — jangan hukum dua kali lewat is_broken.
      if (rule.key === "is_broken" && status) continue;
      rows.push({
        crawlId,
        type: rule.key,
        severity: rule.severity,
        url: page.url,
        message: rule.message,
      });
    }

    // Fallback defensif bila API tidak mengirim check boolean tertentu.
    if (!page.title && !page.checks.no_title) {
      rows.push({
        crawlId,
        type: "no_title",
        severity: SeoIssueSeverity.HIGH,
        url: page.url,
        message: "Halaman tanpa title tag.",
      });
    }
    if (page.h1Count === 0 && !page.checks.no_h1_tag) {
      rows.push({ crawlId, type: "no_h1_tag", severity: SeoIssueSeverity.MEDIUM, url: page.url, message: "Halaman tanpa heading H1." });
    } else if (page.h1Count > 1) {
      rows.push({ crawlId, type: "multiple_h1", severity: SeoIssueSeverity.LOW, url: page.url, message: `Halaman memiliki ${page.h1Count} heading H1.` });
    }
    if (!page.description && !page.checks.no_description) {
      rows.push({ crawlId, type: "no_description", severity: SeoIssueSeverity.MEDIUM, url: page.url, message: "Halaman tanpa meta description." });
    }
    if (page.onpageScore != null && page.onpageScore < 50) {
      rows.push({ crawlId, type: "low_onpage_score", severity: SeoIssueSeverity.MEDIUM, url: page.url, message: `On-page score rendah (${page.onpageScore}/100).` });
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

function buildCrawlPageRows(
  crawlId: string,
  pages: CrawlPageRow[],
): Prisma.SeoCrawlPageCreateManyInput[] {
  return pages.flatMap((page) =>
    page.url
      ? [{
          crawlId,
          url: page.url,
          resourceType: page.resourceType,
          statusCode: page.statusCode,
          onpageScore: page.onpageScore,
          title: page.title,
          description: page.description,
          h1Count: page.h1Count,
          wordCount: page.wordCount,
          internalLinks: page.internalLinks,
          externalLinks: page.externalLinks,
          inboundLinks: page.inboundLinks,
          imagesCount: page.imagesCount,
          clickDepth: page.clickDepth,
          sizeBytes: page.sizeBytes,
          loadTimeMs: page.loadTimeMs,
          isRedirect: page.isRedirect,
          isBroken: page.isBroken,
          fromSitemap: page.fromSitemap,
          isHttps: page.isHttps,
          checks: page.checks as Prisma.InputJsonValue,
        }]
      : [],
  );
}

/**
 * Kembalikan crawl ANALYZING yang macet (proses mati setelah klaim) ke
 * COLLECTING agar poll berikutnya mengulang pengumpulan. Tanpa ini baris
 * ANALYZING terkunci selamanya karena poll sengaja melewatinya.
 */
export async function recoverStaleAnalyzingCrawls(
  crawlIds?: string[],
  now: number = Date.now(),
): Promise<number> {
  if (crawlIds && crawlIds.length === 0) return 0;
  const res = await prisma.seoSiteCrawl.updateMany({
    where: {
      ...(crawlIds ? { id: { in: crawlIds } } : {}),
      status: SeoAnalysisStatus.ANALYZING,
      updatedAt: { lt: new Date(now - ANALYZING_STALE_MS) },
    },
    data: { status: SeoAnalysisStatus.COLLECTING },
  });
  if (res.count > 0) {
    console.warn("[seo/crawler] crawl ANALYZING macet dikembalikan ke COLLECTING", res.count);
  }
  return res.count;
}

/**
 * Ambil hasil crawl bila sudah selesai; update isu, summary, dan Lighthouse.
 *
 * Aman dipanggil bersamaan (polling browser 6 detik × banyak tab + cron):
 * hanya pemanggil yang berhasil mengklaim baris COLLECTING → ANALYZING yang
 * melanjutkan ke pengumpulan (Lighthouse berbayar, tulis isu, notifikasi).
 */
export async function collectCrawlResults(crawlId: string): Promise<void> {
  const crawl = await prisma.seoSiteCrawl.findUnique({ where: { id: crawlId } });
  if (!crawl || !crawl.dataforseoTaskId) return;
  // Hanya COLLECTING yang di-poll; ANALYZING sedang dikerjakan proses lain
  // (atau macet → dipulihkan recoverStaleAnalyzingCrawls).
  if (crawl.status !== SeoAnalysisStatus.COLLECTING) return;

  let summary: CrawlSummary | null;
  let taskStatusCode: number | null;
  let taskStatusMessage: string | null;
  try {
    ({ summary, taskStatusCode, taskStatusMessage } = await fetchOnPageSummary(
      crawl.dataforseoTaskId,
    ));
  } catch (err) {
    console.error("[seo/crawler] summary gagal", crawlId, err);
    return; // coba lagi pada poll berikutnya
  }

  // Task-level error permanen (mis. 40401 Task Not Found) → gagal sekarang,
  // jangan menunggu timeout 2 jam.
  if (!summary && isTerminalTaskStatus(taskStatusCode)) {
    await prisma.seoSiteCrawl.update({
      where: { id: crawlId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        errorMessage: `DataForSEO: ${taskStatusMessage ?? "task gagal"} (${taskStatusCode}).`,
      },
    });
    return;
  }

  // Periksa hasil lebih dulu: task yang sudah selesai tetap harus dikumpulkan
  // walaupun cron/polling sempat mati lebih dari batas timeout.
  if (!summary || summary.crawlProgress !== "finished") {
    // updatedAt bergerak saat task dimulai/di-refresh atau progress bertambah,
    // sehingga refresh crawl lama tidak langsung timeout berdasarkan createdAt.
    // Cek ini juga berlaku saat ringkasan masih kosong (task antre terlalu lama).
    if (Date.now() - crawl.updatedAt.getTime() > CRAWL_TIMEOUT_MS) {
      await prisma.seoSiteCrawl.update({
        where: { id: crawlId },
        data: {
          status: SeoAnalysisStatus.FAILED,
          errorMessage: "Crawl melebihi batas waktu (timeout).",
        },
      });
      return;
    }

    // Update progress meski belum selesai.
    if (
      summary &&
      summary.pagesCrawled != null &&
      summary.pagesCrawled !== crawl.pagesCrawled
    ) {
      await prisma.seoSiteCrawl.update({
        where: { id: crawlId },
        data: { pagesCrawled: summary.pagesCrawled },
      });
    }
    return;
  }

  // Selesai → klaim baris secara atomik. count === 0 berarti proses lain
  // sudah mengambil alih (atau status berubah) → berhenti tanpa efek samping.
  const claimed = await prisma.seoSiteCrawl.updateMany({
    where: { id: crawlId, status: SeoAnalysisStatus.COLLECTING },
    data: { status: SeoAnalysisStatus.ANALYZING },
  });
  if (claimed.count === 0) return;

  try {
    await finalizeCrawl(crawl, summary);
  } catch (err) {
    // Lepaskan klaim agar poll berikutnya mencoba lagi (bukan menunggu 20 menit).
    await prisma.seoSiteCrawl
      .updateMany({
        where: { id: crawlId, status: SeoAnalysisStatus.ANALYZING },
        data: { status: SeoAnalysisStatus.COLLECTING },
      })
      .catch(() => undefined);
    throw err;
  }
}

type ClaimedCrawl = NonNullable<
  Awaited<ReturnType<typeof prisma.seoSiteCrawl.findUnique>>
>;

/** Kumpulkan halaman + Lighthouse, hitung isu/health, tulis hasil (setelah klaim). */
async function finalizeCrawl(
  crawl: ClaimedCrawl,
  summary: CrawlSummary,
): Promise<void> {
  const crawlId = crawl.id;
  const taskId = crawl.dataforseoTaskId!;

  let pages: CrawlPageRow[] = [];
  let pagesFetched = false;
  try {
    pages = await fetchOnPagePages(taskId, crawl.maxPages);
    pagesFetched = true;
  } catch (err) {
    console.warn("[seo/crawler] pages gagal (lanjut dengan agregat)", err);
  }

  const pagesCrawled = summary.pagesCrawled ?? pages.length;
  const metricsAvailable = hasPageMetrics(summary);

  // Tidak ada data yang bisa dinilai → FAILED, bukan "Health 100".
  if (pagesCrawled === 0 || (!pagesFetched && !metricsAvailable)) {
    await prisma.seoSiteCrawl.update({
      where: { id: crawlId },
      data: {
        status: SeoAnalysisStatus.FAILED,
        pagesCrawled,
        summary: summary as unknown as Prisma.InputJsonValue,
        healthScore: null,
        errorMessage: CRAWL_NO_PAGES_MESSAGE,
        dataNotice: pagesFetched ? null : CRAWL_PAGES_UNAVAILABLE_NOTICE,
      },
    });
    return;
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
  const allIssues = [...aggregateIssues, ...pageIssues];
  const pageRows = buildCrawlPageRows(crawlId, pages);

  // Agregat DataForSEO sudah menghitung dampak per halaman. Jangan menghukum
  // health score dua kali dengan isu agregat + salinan isu URL yang sama.
  // Tanpa metrik agregat maupun daftar halaman, skor tidak dihitung sama sekali.
  const scoreIssues = metricsAvailable ? aggregateIssues : pageIssues;
  const canScore = metricsAvailable || (pagesFetched && pages.length > 0);
  const healthScore = canScore
    ? computeHealthScore(
        scoreIssues.map((i) => ({
          severity: i.severity,
          count: "count" in i && i.count != null ? i.count : 1,
        })),
        pagesCrawled,
      )
    : null;

  const notices: string[] = [];
  if (!pagesFetched) notices.push(CRAWL_PAGES_UNAVAILABLE_NOTICE);
  if (!canScore) notices.push(CRAWL_NO_METRICS_NOTICE);

  // Diff vs crawl READY sebelumnya untuk domain + maxPages yang sama.
  const previous = await prisma.seoSiteCrawl.findFirst({
    where: {
      id: { not: crawlId },
      domain: crawl.domain,
      maxPages: crawl.maxPages,
      status: SeoAnalysisStatus.READY,
    },
    orderBy: { createdAt: "desc" },
    include: { issues: true },
  });
  // Bila daftar halaman gagal diambil, jangan bandingkan isu per-URL: semua
  // isu lama akan tampak "diperbaiki" padahal datanya saja yang tidak ada.
  const toDiffable = (i: {
    type: string;
    url: string | null;
    severity: string;
    message: string | null;
    count: number | null;
  }): DiffableIssue => ({
    type: i.type,
    url: i.url ?? null,
    severity: i.severity,
    message: i.message ?? "",
    count: i.count != null ? i.count : 1,
  });
  const issueDiff = previous
    ? diffCrawlIssues(
        previous.issues
          .filter((i) => pagesFetched || i.url == null)
          .map(toDiffable),
        (pagesFetched ? allIssues : aggregateIssues).map((i) =>
          toDiffable({
            type: i.type,
            url: i.url ?? null,
            severity: i.severity,
            message: i.message ?? null,
            count: "count" in i && i.count != null ? i.count : null,
          }),
        ),
      )
    : null;

  const mutations: Prisma.PrismaPromise<unknown>[] = [
    // Idempoten: hapus semua isu crawl ini lalu tulis ulang dalam satu transaksi.
    prisma.seoCrawlIssue.deleteMany({ where: { crawlId } }),
    prisma.seoCrawlIssue.createMany({ data: allIssues }),
  ];
  if (pagesFetched) {
    mutations.push(prisma.seoCrawlPage.deleteMany({ where: { crawlId } }));
    if (pageRows.length > 0) {
      mutations.push(
        prisma.seoCrawlPage.createMany({ data: pageRows, skipDuplicates: true }),
      );
    }
  }
  mutations.push(
    prisma.seoSiteCrawl.update({
      where: { id: crawlId },
      data: {
        status: SeoAnalysisStatus.READY,
        pagesCrawled,
        summary: summary as unknown as Prisma.InputJsonValue,
        lighthouse: lighthouse
          ? (lighthouse as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        healthScore,
        previousCrawlId: previous?.id ?? null,
        issueDiff: issueDiff
          ? (issueDiff as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        dataNotice: notices.length > 0 ? notices.join(" ") : null,
        errorMessage: null,
      },
    }),
  );
  await prisma.$transaction(mutations);

  // Crawl terjadwal + ada isu berat baru → notifikasi pembuat jadwal.
  if (crawl.scheduleId && issueDiff) {
    const seriousNew = issueDiff.newIssues.filter(
      (i) => i.severity === "CRITICAL" || i.severity === "HIGH",
    );
    if (seriousNew.length > 0) {
      try {
        const healthLabel = healthScore != null ? `${healthScore}/100` : "—";
        await notifyUser(
          crawl.createdById,
          `Audit terjadwal ${crawl.domain}: ${seriousNew.length} isu berat baru (health ${healthLabel}). Contoh: ${seriousNew[0].message}`,
          NotificationType.SEO_ALERT,
        );
      } catch (err) {
        console.error("[seo/crawler] notifikasi isu baru gagal", err);
      }
    }
  }
}

/** Poll semua crawl yang masih berjalan — dipanggil cron (`mode=crawl-poll`). */
export async function pollRunningSiteCrawls(): Promise<{
  checked: number;
  finished: number;
  recovered: number;
}> {
  const recovered = await recoverStaleAnalyzingCrawls();
  const running = await prisma.seoSiteCrawl.findMany({
    where: {
      // ANALYZING sengaja tidak di-poll: sedang dikerjakan proses lain.
      status: SeoAnalysisStatus.COLLECTING,
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
  return { checked: running.length, finished, recovered };
}

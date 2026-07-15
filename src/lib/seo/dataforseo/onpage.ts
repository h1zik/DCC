import "server-only";

import {
  dataForSeoGet,
  dataForSeoLive,
  dataForSeoRequest,
  DataForSeoError,
  DFS_OK,
} from "@/lib/seo/dataforseo/client";
import { withDataForSeoCache } from "@/lib/seo/dataforseo/cache";

/**
 * Wrapper DataForSEO On-Page API untuk On-Page Audit & Technical Crawler.
 *
 * - Audit satu URL: `on_page/instant_pages` (live, di-cache).
 * - Crawl domain: `on_page/task_post` → poll `on_page/summary/{id}` →
 *   `on_page/pages` (metode standard/queue, lebih murah untuk job terjadwal).
 * - Core Web Vitals: `on_page/lighthouse/live/json` (opsional).
 *
 * Parsing dibuat defensif terhadap field yang hilang.
 */

/* -------------------------------------------------------------------------- */
/*                              instant_pages (audit)                          */
/* -------------------------------------------------------------------------- */

export type InstantPageSignals = {
  url: string | null;
  statusCode: number | null;
  onpageScore: number | null;
  title: string | null;
  description: string | null;
  htags: Record<string, string[]>;
  wordCount: number | null;
  internalLinks: number | null;
  externalLinks: number | null;
  imagesCount: number | null;
  hasSchema: boolean | null;
  readability: {
    fleschKincaid: number | null;
    automatedReadability: number | null;
  } | null;
  checks: Record<string, boolean>;
  pageTiming: Record<string, number> | null;
};

type DfsPageItem = {
  resource_type?: string | null;
  url?: string;
  status_code?: number;
  onpage_score?: number;
  click_depth?: number | null;
  size?: number | null;
  meta?: {
    title?: string | null;
    description?: string | null;
    htags?: Record<string, string[]> | null;
    internal_links_count?: number | null;
    external_links_count?: number | null;
    inbound_links_count?: number | null;
    images_count?: number | null;
    content?: {
      plain_text_word_count?: number | null;
      flesch_kincaid_readability_index?: number | null;
      automated_readability_index?: number | null;
    } | null;
  } | null;
  checks?: Record<string, boolean> | null;
  page_timing?: Record<string, number> | null;
};

type DfsInstantPagesResult = { items?: DfsPageItem[] | null };

function parsePageItem(item: DfsPageItem): InstantPageSignals {
  const meta = item.meta ?? {};
  const content = meta.content ?? {};
  const checks = item.checks ?? {};
  return {
    url: item.url ?? null,
    statusCode: item.status_code ?? null,
    onpageScore:
      item.onpage_score != null ? Math.round(item.onpage_score) : null,
    title: meta.title?.trim() || null,
    description: meta.description?.trim() || null,
    htags: meta.htags ?? {},
    wordCount: content.plain_text_word_count ?? null,
    internalLinks: meta.internal_links_count ?? null,
    externalLinks: meta.external_links_count ?? null,
    imagesCount: meta.images_count ?? null,
    hasSchema:
      typeof checks.has_micromarkup === "boolean"
        ? checks.has_micromarkup
        : null,
    readability: {
      fleschKincaid: content.flesch_kincaid_readability_index ?? null,
      automatedReadability: content.automated_readability_index ?? null,
    },
    checks,
    pageTiming: item.page_timing ?? null,
  };
}

/** Audit On-Page satu URL via instant_pages (live), di-cache 24 jam. */
export async function fetchInstantPage(
  url: string,
): Promise<InstantPageSignals | null> {
  const endpoint = "on_page/instant_pages";
  const payload = { url, enable_javascript: false };

  const item = await withDataForSeoCache(endpoint, payload, async () => {
    const result = await dataForSeoLive<DfsInstantPagesResult>(endpoint, payload);
    return result[0]?.items?.[0] ?? null;
  });

  return item ? parsePageItem(item) : null;
}

/* -------------------------------------------------------------------------- */
/*                            task-based crawl (domain)                        */
/* -------------------------------------------------------------------------- */

/** Posting task crawl On-Page. Mengembalikan task id DataForSEO. */
export async function postOnPageCrawlTask(params: {
  target: string;
  maxCrawlPages: number;
}): Promise<string> {
  const endpoint = "on_page/task_post";
  const payload = {
    target: params.target,
    max_crawl_pages: params.maxCrawlPages,
    load_resources: false,
    enable_javascript: false,
    enable_browser_rendering: false,
    check_spell: false,
  };
  const json = await dataForSeoRequest<unknown>(endpoint, [payload]);
  const task = json.tasks?.[0];
  if (!task || (task.status_code !== DFS_OK && task.status_code !== 20100) || !task.id) {
    throw new DataForSeoError(task?.status_message ?? "Gagal memulai crawl.", {
      statusCode: task?.status_code ?? null,
    });
  }
  return task.id;
}

export type CrawlSummary = {
  crawlProgress: string | null;
  pagesCrawled: number | null;
  pagesInQueue: number | null;
  maxCrawlPages: number | null;
  pageMetrics: {
    checks: Record<string, number>;
    brokenLinks: number | null;
    brokenResources: number | null;
    duplicateTitle: number | null;
    duplicateDescription: number | null;
    duplicateContent: number | null;
    redirectLoop: number | null;
    nonIndexable: number | null;
    linksExternal: number | null;
    linksInternal: number | null;
    onpageScore: number | null;
  } | null;
  domainInfo: {
    name: string | null;
    cms: string | null;
    server: string | null;
    ssl: boolean | null;
  } | null;
  /** Check level-domain (sitemap, robots_txt, ssl, http2, dll). */
  domainChecks: Record<string, boolean>;
};

type DfsSummaryResult = {
  crawl_progress?: string;
  crawl_status?: {
    max_crawl_pages?: number;
    pages_in_queue?: number;
    pages_crawled?: number;
  } | null;
  domain_info?: {
    name?: string;
    cms?: string;
    server?: string;
    ssl_info?: { valid_certificate?: boolean } | null;
    checks?: Record<string, boolean> | null;
  } | null;
  page_metrics?: {
    checks?: Record<string, number> | null;
    broken_links?: number;
    broken_resources?: number;
    duplicate_title?: number;
    duplicate_description?: number;
    duplicate_content?: number;
    redirect_loop?: number;
    non_indexable?: number;
    links_external?: number;
    links_internal?: number;
    onpage_score?: number;
  } | null;
};

/** Ambil ringkasan crawl (GET on_page/summary/{id}). */
export async function fetchOnPageSummary(
  taskId: string,
): Promise<CrawlSummary | null> {
  const json = await dataForSeoGet<DfsSummaryResult>(
    `on_page/summary/${taskId}`,
  );
  const result = json.tasks?.[0]?.result?.[0];
  if (!result) return null;

  const pm = result.page_metrics ?? null;
  return {
    crawlProgress: result.crawl_progress ?? null,
    pagesCrawled: result.crawl_status?.pages_crawled ?? null,
    pagesInQueue: result.crawl_status?.pages_in_queue ?? null,
    maxCrawlPages: result.crawl_status?.max_crawl_pages ?? null,
    pageMetrics: pm
      ? {
          checks: pm.checks ?? {},
          brokenLinks: pm.broken_links ?? null,
          brokenResources: pm.broken_resources ?? null,
          duplicateTitle: pm.duplicate_title ?? null,
          duplicateDescription: pm.duplicate_description ?? null,
          duplicateContent: pm.duplicate_content ?? null,
          redirectLoop: pm.redirect_loop ?? null,
          nonIndexable: pm.non_indexable ?? null,
          linksExternal: pm.links_external ?? null,
          linksInternal: pm.links_internal ?? null,
          onpageScore: pm.onpage_score != null ? Math.round(pm.onpage_score) : null,
        }
      : null,
    domainInfo: result.domain_info
      ? {
          name: result.domain_info.name ?? null,
          cms: result.domain_info.cms ?? null,
          server: result.domain_info.server ?? null,
          ssl: result.domain_info.ssl_info?.valid_certificate ?? null,
        }
      : null,
    domainChecks: result.domain_info?.checks ?? {},
  };
}

export type CrawlPageRow = {
  url: string | null;
  resourceType: string | null;
  statusCode: number | null;
  onpageScore: number | null;
  title: string | null;
  description: string | null;
  h1Count: number;
  wordCount: number | null;
  internalLinks: number | null;
  externalLinks: number | null;
  inboundLinks: number | null;
  imagesCount: number | null;
  clickDepth: number | null;
  sizeBytes: number | null;
  loadTimeMs: number | null;
  isRedirect: boolean;
  isBroken: boolean;
  fromSitemap: boolean;
  isHttps: boolean;
  checks: Record<string, boolean>;
};

/** Ambil daftar halaman crawl (POST on_page/pages). */
export async function fetchOnPagePages(
  taskId: string,
  limit = 100,
): Promise<CrawlPageRow[]> {
  const endpoint = "on_page/pages";
  const payload = { id: taskId, limit: Math.min(1000, Math.max(1, limit)) };
  const result = await dataForSeoLive<DfsInstantPagesResult>(endpoint, payload);
  const items = result[0]?.items ?? [];
  return items.map((item) => {
    const meta = item.meta ?? {};
    const content = meta.content ?? {};
    const checks = item.checks ?? {};
    return {
      url: item.url ?? null,
      resourceType: item.resource_type ?? null,
      statusCode: item.status_code ?? null,
      onpageScore: item.onpage_score != null ? Math.round(item.onpage_score) : null,
      title: meta.title?.trim() || null,
      description: meta.description?.trim() || null,
      h1Count: Array.isArray(meta.htags?.h1) ? meta.htags!.h1.length : 0,
      wordCount: content.plain_text_word_count ?? null,
      internalLinks: meta.internal_links_count ?? null,
      externalLinks: meta.external_links_count ?? null,
      inboundLinks: meta.inbound_links_count ?? null,
      imagesCount: meta.images_count ?? null,
      clickDepth: item.click_depth ?? null,
      sizeBytes: item.size ?? null,
      loadTimeMs:
        typeof item.page_timing?.duration_time === "number"
          ? Math.round(item.page_timing.duration_time)
          : null,
      isRedirect: checks.is_redirect === true,
      isBroken: checks.is_broken === true,
      fromSitemap: checks.from_sitemap === true,
      isHttps: checks.is_https === true,
      checks,
    };
  });
}

/* -------------------------------------------------------------------------- */
/*                         Lighthouse (Core Web Vitals)                        */
/* -------------------------------------------------------------------------- */

export type LighthouseMetrics = {
  performanceScore: number | null; // 0-100
  lcp: string | null;
  cls: string | null;
  tbt: string | null;
  fcp: string | null;
  speedIndex: string | null;
};

type DfsLighthouseResult = {
  categories?: { performance?: { score?: number | null } | null } | null;
  audits?: Record<string, { displayValue?: string; numericValue?: number } | undefined> | null;
};

/** Core Web Vitals via Lighthouse live (lambat & lebih mahal — opsional). */
export async function fetchLighthouseLive(
  url: string,
  forMobile = true,
): Promise<LighthouseMetrics | null> {
  const endpoint = "on_page/lighthouse/live/json";
  const payload = { url, for_mobile: forMobile };
  const result = await dataForSeoLive<DfsLighthouseResult>(endpoint, payload, {
    maxRetries: 1,
  });
  const report = result[0];
  if (!report) return null;

  const audits = report.audits ?? {};
  const score = report.categories?.performance?.score;
  return {
    performanceScore: score != null ? Math.round(score * 100) : null,
    lcp: audits["largest-contentful-paint"]?.displayValue ?? null,
    cls: audits["cumulative-layout-shift"]?.displayValue ?? null,
    tbt: audits["total-blocking-time"]?.displayValue ?? null,
    fcp: audits["first-contentful-paint"]?.displayValue ?? null,
    speedIndex: audits["speed-index"]?.displayValue ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/*                      content_parsing (konten via DataForSEO)                 */
/* -------------------------------------------------------------------------- */

// Parser pure ada di content-parsing-parse.ts (agar bisa di-test tanpa server-only).
export {
  parseContentParsingResult,
  type ParsedPageContent,
} from "@/lib/seo/dataforseo/content-parsing-parse";
import {
  parseContentParsingResult,
  type DfsContentParsingResult,
  type ParsedPageContent,
} from "@/lib/seo/dataforseo/content-parsing-parse";

/**
 * Ambil konten halaman via DataForSEO (`on_page/content_parsing/live`) —
 * fallback saat fetch langsung diblokir bot-wall. Di-cache seperti biasa.
 */
export async function fetchContentParsing(
  url: string,
): Promise<ParsedPageContent | null> {
  const endpoint = "on_page/content_parsing/live";
  const payload = { url, enable_javascript: false };

  const result = await withDataForSeoCache(endpoint, payload, async () => {
    return await dataForSeoLive<DfsContentParsingResult>(endpoint, payload, {
      maxRetries: 1,
    });
  });
  return parseContentParsingResult(result);
}

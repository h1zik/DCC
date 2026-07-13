import "server-only";

import {
  extractArticleSignals,
  type CompetitorHeading,
} from "@/lib/seo/content/competitor-extract";
import { isPathAllowed } from "@/lib/seo/content/robots";
import { isDataForSeoConfigured } from "@/lib/seo/dataforseo/client";
import { fetchContentParsing } from "@/lib/seo/dataforseo/onpage";

/**
 * Fetch halaman kompetitor untuk grounding brief. Best-effort: kegagalan satu
 * halaman tidak boleh menjatuhkan pipeline — hasil per-URL membawa
 * `fetchStatus`. robots.txt (grup `*`) dihormati secara sederhana.
 */

const FETCH_TIMEOUT_MS = 10_000;
const ROBOTS_TIMEOUT_MS = 5_000;
const MAX_BYTES = 1_500_000;
const CONCURRENCY = 4;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 DCC-SEO-Research/1.0";

/** Domain yang bukan artikel — tidak berguna untuk grounding konten. */
const DOMAIN_BLOCKLIST = [
  "youtube.com",
  "shopee.co.id",
  "tokopedia.com",
  "lazada.co.id",
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
];

export type CompetitorPage = {
  url: string;
  domain: string;
  fetchStatus: "ok" | "blocked" | "failed" | "skipped";
  error?: string;
  title: string | null;
  metaDescription: string | null;
  wordCount: number;
  headings: CompetitorHeading[];
  /** Untuk analisis term saja — JANGAN dipersist. */
  bodyText: string;
};

function emptyPage(
  url: string,
  fetchStatus: CompetitorPage["fetchStatus"],
  error?: string,
): CompetitorPage {
  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* url rusak */
  }
  return {
    url,
    domain,
    fetchStatus,
    error,
    title: null,
    metaDescription: null,
    wordCount: 0,
    headings: [],
    bodyText: "",
  };
}

function isBlockedDomain(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return DOMAIN_BLOCKLIST.some(
    (b) => host === b || host.endsWith(`.${b}`),
  );
}

/** Baca body dengan batas byte agar halaman raksasa tidak menghabiskan memori. */
async function readBodyCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
      if (total >= MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

/** Cache robots.txt per-origin selama satu run (module-level, best-effort). */
async function fetchRobots(
  origin: string,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (cache.has(origin)) return cache.get(origin) ?? null;
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(ROBOTS_TIMEOUT_MS),
      redirect: "follow",
    });
    const text = res.ok ? await res.text() : null;
    cache.set(origin, text);
    return text;
  } catch {
    cache.set(origin, null);
    return null;
  }
}

export async function fetchCompetitorPage(
  url: string,
  robotsCache: Map<string, string | null> = new Map(),
): Promise<CompetitorPage> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return emptyPage(url, "failed", "URL tidak valid.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return emptyPage(url, "skipped", "Protokol tidak didukung.");
  }
  if (isBlockedDomain(parsed.hostname)) {
    return emptyPage(url, "skipped", "Domain non-artikel (blocklist).");
  }

  const robots = await fetchRobots(parsed.origin, robotsCache);
  if (robots && !isPathAllowed(robots, parsed.pathname)) {
    return emptyPage(url, "blocked", "Dilarang robots.txt.");
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.6",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) return emptyPage(url, "failed", `HTTP ${res.status}`);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return emptyPage(url, "skipped", `Bukan HTML (${contentType || "?"}).`);
    }

    const html = await readBodyCapped(res);
    const signals = extractArticleSignals(html);
    return {
      url,
      domain: parsed.hostname.replace(/^www\./, ""),
      fetchStatus: "ok",
      title: signals.title,
      metaDescription: signals.metaDescription,
      wordCount: signals.wordCount,
      headings: signals.headings,
      bodyText: signals.bodyText,
    };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "TimeoutError"
        ? "Timeout."
        : err instanceof Error
          ? err.message
          : "Fetch gagal.";
    return emptyPage(url, "failed", msg);
  }
}

/** Berapa halaman gagal yang dicoba ulang via DataForSEO content_parsing. */
const CONTENT_PARSING_FALLBACK_MAX = 4;

/**
 * Fallback: ambil konten via DataForSEO content_parsing untuk halaman yang
 * gagal/diblokir bot-wall (media beauty Indonesia sering di balik Cloudflare).
 */
async function fallbackViaContentParsing(
  page: CompetitorPage,
): Promise<CompetitorPage> {
  try {
    const parsed = await fetchContentParsing(page.url);
    if (!parsed || parsed.wordCount < 50) return page;
    return {
      ...page,
      fetchStatus: "ok",
      error: undefined,
      title: parsed.title ?? page.title,
      metaDescription: parsed.metaDescription ?? page.metaDescription,
      wordCount: parsed.wordCount,
      headings: parsed.headings.filter(
        (h): h is CompetitorHeading => h.level === 2 || h.level === 3,
      ),
      bodyText: parsed.bodyText,
    };
  } catch (err) {
    console.warn("[seo/competitor-fetch] content_parsing fallback gagal", page.url, err);
    return page;
  }
}

/** Fetch banyak halaman kompetitor dengan batas konkurensi + fallback DataForSEO. */
export async function fetchCompetitorPages(
  urls: string[],
): Promise<CompetitorPage[]> {
  const robotsCache = new Map<string, string | null>();
  const results: CompetitorPage[] = [];
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((u) => fetchCompetitorPage(u, robotsCache)),
    );
    for (let j = 0; j < settled.length; j++) {
      const s = settled[j];
      results.push(
        s.status === "fulfilled"
          ? s.value
          : emptyPage(batch[j], "failed", "Fetch gagal."),
      );
    }
  }

  // Fallback content_parsing untuk yang gagal/blocked (bukan skipped/blocklist).
  if (isDataForSeoConfigured()) {
    let used = 0;
    for (let i = 0; i < results.length; i++) {
      if (used >= CONTENT_PARSING_FALLBACK_MAX) break;
      const page = results[i];
      if (page.fetchStatus !== "failed" && page.fetchStatus !== "blocked") continue;
      results[i] = await fallbackViaContentParsing(page);
      used += 1;
    }
  }

  return results;
}

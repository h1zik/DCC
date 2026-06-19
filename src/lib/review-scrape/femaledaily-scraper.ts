import * as cheerio from "cheerio";

import type { NormalizedReview } from "@/lib/apify/normalize";

const FD_HOST = "reviews.femaledaily.com";
const DEFAULT_MAX_PAGES = 50;
const DEFAULT_MAX_REVIEWS = 500;
const PAGE_DELAY_MS = 350;

const FETCH_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
};

export type FemaleDailyScrapeOptions = {
  maxPages?: number;
  maxReviews?: number;
};

export type FemaleDailyScrapeResult = {
  reviews: NormalizedReview[];
  totalReported: number | null;
  pagesFetched: number;
  complete: boolean;
};

/** Normalisasi URL produk FD ke host `reviews.femaledaily.com`. */
export function normalizeFemaleDailyProductUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("URL Female Daily tidak valid.");
  }

  const host = parsed.hostname.toLowerCase();
  if (!host.includes("femaledaily.com")) {
    throw new Error("URL harus dari reviews.femaledaily.com.");
  }

  if (host === "review.femaledaily.com") {
    parsed.hostname = FD_HOST;
  } else if (host !== FD_HOST && host.endsWith("femaledaily.com")) {
    parsed.hostname = FD_HOST;
  }

  if (!parsed.pathname.includes("/products/")) {
    throw new Error(
      "Gunakan URL halaman produk Female Daily (contoh: https://reviews.femaledaily.com/products/.../brand/slug).",
    );
  }

  parsed.protocol = "https:";
  if (!parsed.searchParams.has("order")) {
    parsed.searchParams.set("order", "newest");
  }
  parsed.searchParams.delete("page");

  return parsed.toString();
}

function buildPageUrl(baseUrl: string, page: number): string {
  const parsed = new URL(baseUrl);
  parsed.searchParams.set("page", String(page));
  return parsed.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseReviewDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseRatingFromStars(card: cheerio.Cheerio<any>): number | null {
  const full = card.find(".cardrv-starlist i.icon-ic_big_star_full").length;
  if (full > 0) return full;
  const small = card.find(".cardrv-smstarlist i.icon-ic_big_star_full").length;
  return small > 0 ? small : null;
}

function extractReviewId(card: cheerio.Cheerio<any>): string | null {
  const commentEl = card.find("[id^='comment-count-']").first();
  const idAttr = commentEl.attr("id");
  if (idAttr) {
    const m = idAttr.match(/comment-count-(\d+)/);
    if (m) return m[1];
  }
  return null;
}

function parseReviewCards(html: string): NormalizedReview[] {
  const $ = cheerio.load(html);
  const out: NormalizedReview[] = [];

  $(".review-card").each((_, el) => {
    const card = $(el);
    const author = card.find(".profile-username").first().text().trim() || null;
    const text = card.find(".text-content span").first().text().trim();
    if (!text) return;

    const dateRaw = card.find(".review-date").first().text().trim();
    const reviewId = extractReviewId(card);
    const externalId =
      reviewId ?? `${author ?? "anon"}-${dateRaw}-${out.length}`.replace(/\s+/g, "-");

    out.push({
      externalId,
      author,
      rating: parseRatingFromStars(card),
      text,
      reviewDate: parseReviewDate(dateRaw),
    });
  });

  return out;
}

function parseTotalReviewCount(html: string): number | null {
  const $ = cheerio.load(html);
  const text = $(".total-reviews").first().text().replace(/\s+/g, " ").trim();
  const m = text.match(/(\d[\d.,]*)\s*(?:review|ulasan)/i) ?? text.match(/^(\d[\d.,]+)/);
  if (!m) return null;
  const n = Number(m[1].replace(/[.,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function fetchFemaleDailyHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    throw new Error(`Female Daily fetch gagal (${res.status}).`);
  }

  const finalUrl = res.url;
  if (!finalUrl.includes("/products/")) {
    throw new Error(
      "URL produk Female Daily tidak ditemukan (redirect ke halaman lain). Salin URL lengkap dari browser di reviews.femaledaily.com.",
    );
  }

  return res.text();
}

export async function scrapeFemaleDailyReviews(
  productUrl: string,
  opts?: FemaleDailyScrapeOptions,
): Promise<FemaleDailyScrapeResult> {
  const baseUrl = normalizeFemaleDailyProductUrl(productUrl);
  const maxPages = opts?.maxPages ?? DEFAULT_MAX_PAGES;
  const maxReviews = opts?.maxReviews ?? DEFAULT_MAX_REVIEWS;

  const all: NormalizedReview[] = [];
  const seen = new Set<string>();
  let totalReported: number | null = null;
  let pagesFetched = 0;
  let complete = true;

  for (let page = 1; page <= maxPages; page += 1) {
    if (page > 1) await sleep(PAGE_DELAY_MS);

    const pageUrl = buildPageUrl(baseUrl, page);
    const html = await fetchFemaleDailyHtml(pageUrl);
    pagesFetched += 1;

    if (page === 1) {
      totalReported = parseTotalReviewCount(html);
    }

    const batch = parseReviewCards(html);
    if (batch.length === 0) break;

    for (const review of batch) {
      if (seen.has(review.externalId)) continue;
      seen.add(review.externalId);
      all.push(review);
      if (all.length >= maxReviews) {
        complete = false;
        break;
      }
    }

    if (all.length >= maxReviews) break;

    if (page === maxPages && batch.length > 0) {
      complete = false;
    }
  }

  return { reviews: all, totalReported, pagesFetched, complete };
}

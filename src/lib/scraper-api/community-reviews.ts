import "server-only";

import type { NormalizedReview, ReviewScrapeMeta } from "@/lib/apify/normalize";
import { cleanShopeeUrl } from "@/lib/apify/shopee-url";
import { loadAllVpsRunItems, startVpsActorRun } from "@/lib/scraper-api/client";

export type VpsProductReviewsResult = {
  reviews: NormalizedReview[];
  meta: ReviewScrapeMeta;
};

/** Bulan Indonesia (singkatan 3 huruf pertama) → index 0-11. */
const ID_MONTHS: Record<string, number> = {
  jan: 0, feb: 1, peb: 1, mar: 2, apr: 3, mei: 4, jun: 5,
  jul: 6, agu: 7, agt: 7, ags: 7, sep: 8, okt: 9, nov: 10, des: 11,
};

/**
 * Lazada mengembalikan tanggal sebagai teks Indonesia, mis. "19 Mei 2026",
 * "06 Feb 2026", atau relatif "3 minggu lalu" / "kemarin". `new Date()` tidak
 * bisa parse bulan Indonesia maupun frasa relatif, jadi tangani manual.
 */
function parseIndonesianDate(raw: string): Date | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  if (s === "hari ini") return new Date();
  if (s === "kemarin") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }

  const rel = s.match(
    /(\d+)\s*(detik|menit|jam|hari|minggu|bulan|tahun)\s*(?:yang\s+)?lalu/,
  );
  if (rel) {
    const n = Number(rel[1]);
    const d = new Date();
    switch (rel[2]) {
      case "detik": d.setSeconds(d.getSeconds() - n); break;
      case "menit": d.setMinutes(d.getMinutes() - n); break;
      case "jam": d.setHours(d.getHours() - n); break;
      case "hari": d.setDate(d.getDate() - n); break;
      case "minggu": d.setDate(d.getDate() - n * 7); break;
      case "bulan": d.setMonth(d.getMonth() - n); break;
      case "tahun": d.setFullYear(d.getFullYear() - n); break;
    }
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const abs = s.match(/(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})/);
  if (abs) {
    const month = ID_MONTHS[abs[2]!.slice(0, 3)];
    if (month != null) {
      const d = new Date(Number(abs[3]), month, Number(abs[1]));
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function parseReviewDate(raw: unknown): Date | null {
  if (raw == null) return null;
  if (typeof raw === "string" && raw.trim()) {
    const id = parseIndonesianDate(raw);
    if (id) return id;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const n =
    typeof raw === "number"
      ? raw
      : Number(String(raw).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n > 1_000_000_000_000 ? n : n * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeVpsReviewItem(
  item: Record<string, unknown>,
  index: number,
): NormalizedReview | null {
  const text =
    (typeof item.comment === "string" && item.comment.trim()) ||
    (typeof item.content === "string" && item.content.trim()) ||
    (typeof item.text === "string" && item.text.trim()) ||
    "";
  if (!text) return null;

  const externalId =
    (typeof item.orderid === "string" && item.orderid) ||
    (typeof item.orderid === "number" && String(item.orderid)) ||
    (typeof item.review_id === "string" && item.review_id) ||
    (typeof item.review_id === "number" && String(item.review_id)) ||
    (typeof item.externalId === "string" && item.externalId) ||
    (typeof item.external_id === "string" && item.external_id) ||
    `review-${index}`;

  const author =
    (typeof item.author_username === "string" && item.author_username) ||
    (typeof item.buyer === "string" && item.buyer) ||
    (typeof item.author === "string" && item.author) ||
    null;

  const ratingRaw = item.rating_star ?? item.rating;
  const rating =
    typeof ratingRaw === "number" && Number.isFinite(ratingRaw)
      ? ratingRaw
      : typeof ratingRaw === "string"
        ? Number(ratingRaw)
        : null;

  return {
    externalId,
    author,
    rating: rating != null && Number.isFinite(rating) ? rating : null,
    text,
    reviewDate: parseReviewDate(
      item.create_time ??
        item.review_time ??
        item.reviewDate ??
        item.review_date ??
        item.bought_date ??
        item.date,
    ),
  };
}

async function fetchReviewsViaVpsActor(
  actorId: string,
  productUrl: string,
): Promise<VpsProductReviewsResult> {
  const normalizedUrl =
    actorId === "shopee-reviews"
      ? cleanShopeeUrl(productUrl.trim())
      : productUrl.trim();

  const run = await startVpsActorRun(
    actorId,
    {
      product_url: normalizedUrl,
      limit: 500,
      max_pages: 50,
      download_images: false,
    },
    { wait: true, timeout: 900, throwOnFailed: false },
  );

  const rawItems = await loadAllVpsRunItems(run);
  const reviews = rawItems
    .map((item, index) => normalizeVpsReviewItem(item, index))
    .filter((review): review is NormalizedReview => review != null);

  const count = run.count || reviews.length;

  return {
    reviews,
    meta: {
      totalReviewsReported: count,
      reviewsAccessible: reviews.length,
      reviewsComplete:
        run.status !== "failed" && reviews.length > 0 && reviews.length >= count,
      vpsError: run.status === "failed" ? run.error ?? "Scrape VPS gagal" : null,
    },
  };
}

export function fetchFemaleDailyReviewsViaVps(
  productUrl: string,
): Promise<VpsProductReviewsResult> {
  return fetchReviewsViaVpsActor("femaledaily-reviews", productUrl);
}

export function fetchSociollaReviewsViaVps(
  productUrl: string,
): Promise<VpsProductReviewsResult> {
  return fetchReviewsViaVpsActor("sociolla-reviews", productUrl);
}

export function fetchShopeeReviewsViaVps(
  productUrl: string,
): Promise<VpsProductReviewsResult> {
  return fetchReviewsViaVpsActor("shopee-reviews", productUrl);
}

export function fetchLazadaReviewsViaVps(
  productUrl: string,
): Promise<VpsProductReviewsResult> {
  return fetchReviewsViaVpsActor("lazada-reviews", productUrl);
}

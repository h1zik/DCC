import "server-only";

import type { NormalizedReview, ReviewScrapeMeta } from "@/lib/apify/normalize";
import { cleanShopeeUrl } from "@/lib/apify/shopee-url";
import { loadAllVpsRunItems, startVpsActorRun } from "@/lib/scraper-api/client";

export type VpsProductReviewsResult = {
  reviews: NormalizedReview[];
  meta: ReviewScrapeMeta;
};

function parseReviewDate(raw: unknown): Date | null {
  if (raw == null) return null;
  if (typeof raw === "string" && raw.trim()) {
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
    (typeof item.text === "string" && item.text.trim()) ||
    "";
  if (!text) return null;

  const externalId =
    (typeof item.orderid === "string" && item.orderid) ||
    (typeof item.orderid === "number" && String(item.orderid)) ||
    (typeof item.externalId === "string" && item.externalId) ||
    (typeof item.external_id === "string" && item.external_id) ||
    `review-${index}`;

  const author =
    (typeof item.author_username === "string" && item.author_username) ||
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
    reviewDate: parseReviewDate(item.create_time ?? item.reviewDate ?? item.review_date ?? item.date),
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

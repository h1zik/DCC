import "server-only";

import type { NormalizedReview, ReviewScrapeMeta } from "@/lib/apify/normalize";
import { startVpsActorRun } from "@/lib/scraper-api/client";

export type VpsTokopediaReviewsResult = {
  reviews: NormalizedReview[];
  meta: ReviewScrapeMeta;
};

function parseUnixDate(raw: unknown): Date | null {
  if (raw == null) return null;
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
    `tkp-${index}`;

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
    reviewDate: parseUnixDate(item.create_time ?? item.reviewDate ?? item.date),
  };
}

/** Trigger actor `tokopedia-reviews` di VPS — tidak ada scraping lokal. */
export async function fetchTokopediaReviewsViaVps(
  productUrl: string,
): Promise<VpsTokopediaReviewsResult> {
  const run = await startVpsActorRun(
    "tokopedia-reviews",
    {
      product_url: productUrl.trim(),
      limit: 200,
      max_pages: 20,
      download_images: false,
    },
    { wait: true, timeout: 900 },
  );

  const rawItems = run.items ?? [];
  const reviews = rawItems
    .map((item, index) => normalizeVpsReviewItem(item, index))
    .filter((review): review is NormalizedReview => review != null);

  const count = run.count || reviews.length;

  return {
    reviews,
    meta: {
      totalReviewsReported: count,
      reviewsAccessible: reviews.length,
      reviewsComplete: run.status === "completed",
    },
  };
}

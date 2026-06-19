import type { NormalizedReview } from "@/lib/apify/normalize";
import {
  normalizeGenericReviewItems,
  normalizeJsonLdReviewItems,
  normalizeKulqizProductReviews,
  normalizeShopeeProductDetailReviews,
} from "@/lib/apify/normalize";

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function pickDate(obj: Record<string, unknown>, keys: string[]): Date | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" || typeof v === "number") {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

/** Female Daily — flat rows or nested `reviews` array from custom actor. */
export function normalizeFemaleDailyReviews(
  items: Record<string, unknown>[],
): NormalizedReview[] {
  const out: NormalizedReview[] = [];

  for (const item of items) {
    const nested = item.reviews;
    if (Array.isArray(nested)) {
      const productId =
        pickString(item, ["productId", "product_id", "id", "slug"]) ?? "fd";
      for (let i = 0; i < nested.length; i += 1) {
        const r = nested[i] as Record<string, unknown>;
        const text =
          pickString(r, [
            "reviewText",
            "review_text",
            "content",
            "text",
            "comment",
            "body",
          ]) ?? "";
        if (!text.trim()) continue;
        out.push({
          externalId:
            pickString(r, ["id", "reviewId", "review_id"]) ?? `${productId}-${i}`,
          author: pickString(r, ["username", "author", "userName", "name"]),
          rating: pickNumber(r, ["rating", "score", "stars", "star"]),
          text: text.trim(),
          reviewDate: pickDate(r, ["date", "createdAt", "created_at", "reviewDate"]),
        });
      }
      continue;
    }

    const text =
      pickString(item, [
        "reviewText",
        "review_text",
        "content",
        "text",
        "comment",
        "body",
        "review",
      ]) ?? "";
    if (!text.trim()) continue;

    out.push({
      externalId:
        pickString(item, ["id", "reviewId", "review_id"]) ?? `fd-${out.length}`,
      author: pickString(item, ["username", "author", "userName", "name"]),
      rating: pickNumber(item, ["rating", "score", "stars", "star"]),
      text: text.trim(),
      reviewDate: pickDate(item, ["date", "createdAt", "created_at", "reviewDate"]),
    });
  }

  return out;
}

/** Sociolla product reviews — flat or nested under `reviews` / `data.reviews`. */
export function normalizeSociollaReviews(
  items: Record<string, unknown>[],
): NormalizedReview[] {
  const out: NormalizedReview[] = [];

  for (const item of items) {
    const data = item.data;
    const reviewList = Array.isArray(item.reviews)
      ? item.reviews
      : data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).reviews)
        ? ((data as Record<string, unknown>).reviews as unknown[])
        : null;

    if (reviewList) {
      const productId =
        pickString(item, ["productId", "product_id", "id", "slug"]) ?? "soc";
      for (let i = 0; i < reviewList.length; i += 1) {
        const r = reviewList[i] as Record<string, unknown>;
        const text =
          pickString(r, ["detail", "review", "content", "text", "comment", "body"]) ??
          "";
        if (!text.trim()) continue;
        out.push({
          externalId:
            pickString(r, ["id", "reviewId", "review_id"]) ?? `${productId}-${i}`,
          author: pickString(r, ["name", "username", "author", "user_name"]),
          rating: pickNumber(r, ["rating", "score", "stars", "average_rating"]),
          text: text.trim(),
          reviewDate: pickDate(r, ["created_at", "date", "reviewDate", "createdAt"]),
        });
      }
      continue;
    }

    const text =
      pickString(item, ["detail", "review", "content", "text", "comment", "body"]) ??
      "";
    if (!text.trim()) continue;

    out.push({
      externalId:
        pickString(item, ["id", "reviewId", "review_id"]) ?? `soc-${out.length}`,
      author: pickString(item, ["name", "username", "author", "user_name"]),
      rating: pickNumber(item, ["rating", "score", "stars", "average_rating"]),
      text: text.trim(),
      reviewDate: pickDate(item, ["created_at", "date", "reviewDate", "createdAt"]),
    });
  }

  return out;
}

export function normalizeReviewItemsForPlatform(
  platformKey: string,
  items: Record<string, unknown>[],
): NormalizedReview[] {
  switch (platformKey) {
    case "shopee": {
      const fromPdp = normalizeShopeeProductDetailReviews(items);
      if (fromPdp.length > 0) return fromPdp;
      break;
    }
    case "tiktok_shop": {
      const fromKulqiz = normalizeKulqizProductReviews(items);
      if (fromKulqiz.length > 0) return fromKulqiz;
      break;
    }
    case "femaledaily": {
      const fromFd = normalizeFemaleDailyReviews(items);
      if (fromFd.length > 0) return fromFd;
      break;
    }
    case "sociolla": {
      const fromSoc = normalizeSociollaReviews(items);
      if (fromSoc.length > 0) return fromSoc;
      break;
    }
    default:
      break;
  }

  const fromJsonLd = normalizeJsonLdReviewItems(items);
  if (fromJsonLd.length > 0) return fromJsonLd;

  return normalizeGenericReviewItems(items);
}

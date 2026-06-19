import "server-only";

import type { NormalizedReview, ReviewScrapeMeta } from "@/lib/apify/normalize";
import {
  scrapeFemaleDailyReviews,
  type FemaleDailyScrapeResult,
} from "@/lib/review-scrape/femaledaily-scraper";
import {
  scrapeSociollaReviews,
  type SociollaScrapeResult,
} from "@/lib/review-scrape/sociolla-scraper";

export function usesNativeReviewScrape(platformKey: string): boolean {
  return platformKey === "femaledaily" || platformKey === "sociolla";
}

export type NativeReviewScrapeResult = {
  reviews: NormalizedReview[];
  meta: ReviewScrapeMeta;
};

function metaFromFemaleDaily(result: FemaleDailyScrapeResult): ReviewScrapeMeta {
  const count = result.reviews.length;
  return {
    totalReviewsReported: result.totalReported ?? count,
    reviewsAccessible: count,
    reviewsComplete: result.complete,
  };
}

function metaFromSociolla(result: SociollaScrapeResult): ReviewScrapeMeta {
  const count = result.reviews.length;
  return {
    totalReviewsReported: result.totalReported ?? count,
    reviewsAccessible: count,
    reviewsComplete: result.complete,
  };
}

export async function scrapeReviewsNative(
  platformKey: string,
  productUrl: string,
): Promise<NativeReviewScrapeResult> {
  switch (platformKey) {
    case "femaledaily": {
      const result = await scrapeFemaleDailyReviews(productUrl);
      if (result.reviews.length === 0) {
        throw new Error(
          "Tidak ada review ditemukan. Pastikan URL produk Female Daily valid dan halaman memiliki review.",
        );
      }
      return {
        reviews: result.reviews,
        meta: metaFromFemaleDaily(result),
      };
    }
    case "sociolla": {
      const result = await scrapeSociollaReviews(productUrl);
      if (result.reviews.length === 0) {
        throw new Error(
          "Tidak ada review ditemukan. Pastikan URL produk Sociolla valid dan produk memiliki review.",
        );
      }
      return {
        reviews: result.reviews,
        meta: metaFromSociolla(result),
      };
    }
    default:
      throw new Error(`Scrape native tidak tersedia untuk platform: ${platformKey}`);
  }
}

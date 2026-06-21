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
import { isScraperApiConfigured } from "@/lib/scraper-api/client";
import { fetchTokopediaReviewsViaVps } from "@/lib/scraper-api/tokopedia-reviews";

export function usesVpsReviewScrape(platformKey: string): boolean {
  return platformKey === "tokopedia" && isScraperApiConfigured();
}

export function usesNativeReviewScrape(platformKey: string): boolean {
  if (platformKey === "femaledaily" || platformKey === "sociolla") return true;
  return usesVpsReviewScrape(platformKey);
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
    case "tokopedia": {
      const result = await fetchTokopediaReviewsViaVps(productUrl);
      if (result.reviews.length === 0) {
        throw new Error(
          "Tidak ada review dari VPS scraper. Pastikan URL produk Tokopedia valid dan SCRAPER_API_URL benar.",
        );
      }
      return result;
    }
    default:
      throw new Error(`Scrape native tidak tersedia untuk platform: ${platformKey}`);
  }
}

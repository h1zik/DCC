import "server-only";

import type { NormalizedReview, ReviewScrapeMeta } from "@/lib/apify/normalize";
import {
  fetchFemaleDailyReviewsViaVps,
  fetchSociollaReviewsViaVps,
} from "@/lib/scraper-api/community-reviews";
import { fetchTokopediaReviewsViaVps } from "@/lib/scraper-api/tokopedia-reviews";
import { isScraperApiConfigured } from "@/lib/scraper-api/client";

const VPS_REVIEW_PLATFORMS = new Set(["tokopedia", "femaledaily", "sociolla"]);

export function usesVpsReviewScrape(platformKey: string): boolean {
  return VPS_REVIEW_PLATFORMS.has(platformKey) && isScraperApiConfigured();
}

export function usesNativeReviewScrape(platformKey: string): boolean {
  return usesVpsReviewScrape(platformKey);
}

export type NativeReviewScrapeResult = {
  reviews: NormalizedReview[];
  meta: ReviewScrapeMeta;
};

export async function scrapeReviewsNative(
  platformKey: string,
  productUrl: string,
): Promise<NativeReviewScrapeResult> {
  switch (platformKey) {
    case "femaledaily": {
      const result = await fetchFemaleDailyReviewsViaVps(productUrl);
      if (result.reviews.length === 0) {
        throw new Error(
          "Tidak ada review ditemukan. Pastikan URL produk Female Daily valid dan halaman memiliki review.",
        );
      }
      return result;
    }
    case "sociolla": {
      const result = await fetchSociollaReviewsViaVps(productUrl);
      if (result.reviews.length === 0) {
        throw new Error(
          "Tidak ada review ditemukan. Pastikan URL produk Sociolla valid dan produk memiliki review.",
        );
      }
      return result;
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

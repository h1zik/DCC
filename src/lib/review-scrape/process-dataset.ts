import "server-only";

import type { NormalizedReview, ReviewScrapeMeta } from "@/lib/apify/normalize";
import {
  extractApifyScrapeErrorMessage,
  extractReviewScrapeMeta,
} from "@/lib/apify/normalize";
import { emptyReviewScrapeFailureMessage } from "@/lib/review-platforms/registry";
import { normalizeReviewItemsForPlatform } from "@/lib/review-platforms/normalizers";

export type CompleteReviewDatasetResult = {
  normalized: NormalizedReview[];
  meta: ReviewScrapeMeta;
  errorMessage: string | null;
};

export function processReviewScrapeDataset(
  platformKey: string,
  items: Record<string, unknown>[],
): CompleteReviewDatasetResult {
  const hasMock = items.some((x) => x._mock === true);
  const actorError = extractApifyScrapeErrorMessage(items);
  const normalized = normalizeReviewItemsForPlatform(platformKey, items);
  const meta = extractReviewScrapeMeta(items);

  if (normalized.length === 0) {
    return {
      normalized,
      meta,
      errorMessage: emptyReviewScrapeFailureMessage(platformKey, {
        hasMock,
        actorError,
      }),
    };
  }

  return { normalized, meta, errorMessage: null };
}

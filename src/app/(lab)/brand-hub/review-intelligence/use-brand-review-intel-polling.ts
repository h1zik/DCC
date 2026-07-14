"use client";

import { pollBrandReviewIntelJobs } from "@/actions/brand-review-intelligence";
import { useBrandJobProgress } from "../use-brand-job-progress";

/** Poll status Apify + refresh UI saat scrape/analisis berjalan. */
export function useBrandReviewIntelPolling(inProgress: boolean): void {
  useBrandJobProgress({
    inProgress,
    poll: pollBrandReviewIntelJobs,
    intervalMs: 12_000,
  });
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { pollBrandReviewIntelJobs } from "@/actions/brand-review-intelligence";

const POLL_MS = 6_000;

/** Poll status Apify + refresh UI saat scrape/analisis berjalan. */
export function useBrandReviewIntelPolling(inProgress: boolean): void {
  const router = useRouter();

  useEffect(() => {
    if (!inProgress) return;

    const tick = async () => {
      try {
        await pollBrandReviewIntelJobs();
      } catch {
        /* ignore — refresh tetap jalan */
      }
      router.refresh();
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => window.clearInterval(id);
  }, [inProgress, router]);
}

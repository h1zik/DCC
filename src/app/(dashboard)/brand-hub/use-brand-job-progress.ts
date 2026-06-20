"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { pollBrandHubBackgroundJobs } from "@/actions/brand-jobs";

function isPageVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

/**
 * Poll Brand Hub background jobs while work is in progress.
 * Skips ticks when the tab is hidden to avoid refresh lag.
 */
export function useBrandJobProgress(opts: {
  inProgress: boolean;
  poll?: () => Promise<unknown>;
  intervalMs?: number;
  /** When false, only runs poll — no router.refresh(). Default true. */
  refresh?: boolean;
}): void {
  const {
    inProgress,
    poll = pollBrandHubBackgroundJobs,
    intervalMs = 12_000,
    refresh = true,
  } = opts;
  const router = useRouter();

  useEffect(() => {
    if (!inProgress) return;

    const tick = async () => {
      if (!isPageVisible()) return;

      if (poll) {
        try {
          await poll();
        } catch {
          /* ignore — refresh may still run */
        }
      }
      if (refresh) {
        router.refresh();
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), intervalMs);

    const onVisible = () => {
      if (isPageVisible()) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [inProgress, poll, intervalMs, refresh, router]);
}

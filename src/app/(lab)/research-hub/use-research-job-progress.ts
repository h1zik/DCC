"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Generalized polling hook for Research Hub background jobs. While `inProgress`
 * is true it optionally runs a server `poll` action (e.g. to advance Apify
 * jobs) and then `router.refresh()` so server-rendered progress fields
 * (percent / stepLabel) update without a manual reload.
 *
 * Replaces the per-module bespoke polling effects with one consistent hook.
 */
export function useResearchJobProgress(opts: {
  inProgress: boolean;
  poll?: () => Promise<unknown>;
  intervalMs?: number;
}): void {
  const { inProgress, poll, intervalMs = 8_000 } = opts;
  const router = useRouter();

  useEffect(() => {
    if (!inProgress) return;

    const tick = async () => {
      if (poll) {
        try {
          await poll();
        } catch {
          /* ignore — refresh tetap jalan */
        }
      }
      router.refresh();
    };

    void tick();
    const id = window.setInterval(() => void tick(), intervalMs);
    return () => window.clearInterval(id);
  }, [inProgress, poll, intervalMs, router]);
}

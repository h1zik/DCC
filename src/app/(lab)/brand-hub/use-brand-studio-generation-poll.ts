"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getBrandStudioGenerationStatus } from "@/actions/brand-jobs";

/**
 * Lightweight polling for Strategy / Creative Guideline generation.
 * Uses a tiny status query instead of full page RSC refresh every few seconds.
 */
export function useBrandStudioGenerationPoll(opts: {
  active: boolean;
  selectedId: string | null;
  brandId: string | null;
  intervalMs?: number;
}): void {
  const { active, selectedId, brandId, intervalMs = 10_000 } = opts;
  const router = useRouter();

  useEffect(() => {
    if (!active || !selectedId) return;

    const tick = async () => {
      if (document.visibilityState === "hidden") return;

      try {
        const snap = await getBrandStudioGenerationStatus(brandId);
        const strategy = snap.strategies.find((s) => s.id === selectedId);
        const guideline = snap.guidelines.find((g) => g.id === selectedId);
        const row = strategy ?? guideline;

        if (row && row.status !== "GENERATING" && row.status !== "PENDING") {
          router.refresh();
        }
      } catch {
        /* non-critical */
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, selectedId, brandId, intervalMs, router]);
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pollProductDiscoveryJobs } from "@/actions/research-product-discovery";

export function useProductDiscoveryPolling(inProgress: boolean): void {
  const router = useRouter();

  useEffect(() => {
    if (!inProgress) return;

    const tick = async () => {
      try {
        await pollProductDiscoveryJobs();
      } catch {
        /* ignore */
      }
      router.refresh();
    };

    void tick();
    const id = window.setInterval(tick, 5_000);
    return () => window.clearInterval(id);
  }, [inProgress, router]);
}

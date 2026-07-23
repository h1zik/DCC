"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pollProductDiscoveryJobs } from "@/actions/research-product-discovery";

export function useProductDiscoveryPolling(inProgress: boolean): void {
  const router = useRouter();

  useEffect(() => {
    if (!inProgress) return;

    const tick = async () => {
      // Tab hidden: lewati — lanjut otomatis saat kembali visible.
      if (document.visibilityState === "hidden") return;
      try {
        await pollProductDiscoveryJobs();
      } catch {
        /* ignore */
      }
      router.refresh();
    };

    void tick();
    const id = window.setInterval(tick, 5_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [inProgress, router]);
}

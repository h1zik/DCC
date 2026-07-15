"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pollSeoSiteCrawls } from "@/actions/seo-crawler";

const POLL_INTERVAL_MS = 6_000;
const INITIAL_POLL_DELAY_MS = 1_000;

/** Poll hasil DataForSEO secara berurutan selama ada crawl yang masih sibuk. */
export function useSeoCrawlPolling(crawlIds: string[]) {
  const router = useRouter();
  const crawlIdsKey = [...crawlIds].sort().join("|");

  useEffect(() => {
    if (!crawlIdsKey) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ids = crawlIdsKey.split("|");

    async function poll() {
      try {
        await pollSeoSiteCrawls(ids);
      } catch (err) {
        // Cron masih menjadi fallback; kegagalan sementara tidak mematikan
        // siklus polling selama halaman tetap terbuka.
        console.error("[seo/crawler] polling halaman gagal", err);
      }

      if (cancelled) return;
      router.refresh();
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    // Delay singkat mencegah double-call saat Strict Mode me-mount ulang effect.
    timer = setTimeout(poll, INITIAL_POLL_DELAY_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [crawlIdsKey, router]);
}

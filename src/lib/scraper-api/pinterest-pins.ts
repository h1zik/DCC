import "server-only";

import {
  isScraperApiConfigured,
  loadAllVpsRunItems,
  startVpsActorRun,
} from "@/lib/scraper-api/client";

export function getVpsPinterestActorId(): string {
  return process.env.SCRAPER_API_PINTEREST_ACTOR?.trim() || "pinterest-scraper";
}

export function isVpsPinterestConfigured(): boolean {
  return isScraperApiConfigured();
}

/** Scrape Pinterest pins by keyword via VPS scraper API. */
export async function fetchPinterestSearchViaVps(
  keyword: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const search = keyword.trim();
  if (!search) return [];

  const run = await startVpsActorRun(
    getVpsPinterestActorId(),
    {
      search,
      maxItems: limit,
    },
    { wait: true, timeout: 900, throwOnFailed: false },
  );

  if (run.status === "failed" && (!run.items || run.items.length === 0)) {
    throw new Error(run.error ?? "VPS Pinterest gagal tanpa pesan error.");
  }

  const items = await loadAllVpsRunItems(run);
  return items.slice(0, limit);
}

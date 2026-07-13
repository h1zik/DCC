import "server-only";

import { SeoRankDevice } from "@prisma/client";
import {
  dataForSeoLive,
  getDataForSeoLanguageCode,
  getDataForSeoLocationCode,
} from "@/lib/seo/dataforseo/client";
import { withDataForSeoCache } from "@/lib/seo/dataforseo/cache";
import {
  extractSerpFeatures,
  type SerpResultItem,
} from "@/lib/seo/dataforseo/serp-parse";

/**
 * Wrapper SERP Google Organic untuk SERP Rank Tracker.
 *
 * Fase 1 memakai metode `live/advanced` (deterministik & sederhana untuk cron
 * harian), dengan cache 24 jam agar tidak menghabiskan biaya berulang. Untuk
 * volume keyword besar, DataForSEO menyediakan metode standard/queue (task_post
 * → task_get) yang lebih murah — model `SeoJob.dataforseoTaskId` sudah disiapkan
 * untuk migrasi ke metode itu di fase lanjutan tanpa mengubah skema.
 *
 * Helper parsing murni ada di `serp-parse.ts` (di-re-export di bawah).
 */

export type { SerpResultItem } from "@/lib/seo/dataforseo/serp-parse";
export {
  extractSerpFeatures,
  findAllDomainMatches,
  findDomainRank,
  findDomainRanks,
  normalizeDomain,
} from "@/lib/seo/dataforseo/serp-parse";

type DfsSerpResult = {
  items?: SerpResultItem[] | null;
};

export type SerpLookup = {
  items: SerpResultItem[];
  serpFeatures: string[];
};

function deviceToParam(device: SeoRankDevice): "desktop" | "mobile" {
  return device === SeoRankDevice.DESKTOP ? "desktop" : "mobile";
}

export type SerpQueryOptions = {
  locationCode?: number;
  languageCode?: string;
  device?: SeoRankDevice;
  /** Kedalaman hasil (default 100 = top 100). */
  depth?: number;
};

/**
 * Ambil SERP organik untuk satu keyword (metode live/advanced), di-cache 24 jam.
 */
export async function fetchSerpLive(
  keyword: string,
  opts: SerpQueryOptions = {},
): Promise<SerpLookup> {
  const kw = keyword.trim();
  if (!kw) return { items: [], serpFeatures: [] };

  const endpoint = "serp/google/organic/live/advanced";
  const payload = {
    keyword: kw,
    location_code: opts.locationCode ?? getDataForSeoLocationCode(),
    language_code: opts.languageCode ?? getDataForSeoLanguageCode(),
    device: deviceToParam(opts.device ?? SeoRankDevice.MOBILE),
    depth: Math.min(700, Math.max(10, opts.depth ?? 100)),
  };

  const items = await withDataForSeoCache(endpoint, payload, async () => {
    const result = await dataForSeoLive<DfsSerpResult>(endpoint, payload);
    return result[0]?.items ?? [];
  });

  return { items, serpFeatures: extractSerpFeatures(items) };
}

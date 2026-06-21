import "server-only";

import { SocialListeningPlatform } from "@prisma/client";
import {
  getVpsRunStatus,
  isScraperApiConfigured,
  loadAllVpsRunItems,
} from "@/lib/scraper-api/client";
import {
  parseVpsInstagramMentionItems,
  parseVpsTikTokMentionItems,
} from "@/lib/scraper-api/social-mentions";
import {
  cacheVpsRun,
  getCachedVpsRun,
  type CachedVpsRun,
} from "@/lib/scraper-api/vps-run-cache";

const VPS_TERMINAL = new Set(["completed", "failed", "cancelled"]);

function parseVpsMentions(
  platform: SocialListeningPlatform,
  items: Record<string, unknown>[],
) {
  return platform === SocialListeningPlatform.TIKTOK
    ? parseVpsTikTokMentionItems(items)
    : parseVpsInstagramMentionItems(items);
}

/** Ambil hasil VPS dari mem-cache atau fetch ulang ke API (penting saat after() kehilangan cache). */
export async function resolveVpsCachedRun(
  runId: string,
  platform: SocialListeningPlatform,
): Promise<CachedVpsRun & { done: boolean }> {
  if (!isScraperApiConfigured() || !runId || runId.startsWith("ig-empty-")) {
    const cached = getCachedVpsRun(runId);
    if (cached) return { ...cached, done: cached.done };
    return {
      done: true,
      succeeded: false,
      mentions: [],
      status: "missing",
    };
  }

  try {
    const run = await getVpsRunStatus(runId);
    if (!VPS_TERMINAL.has(run.status)) {
      return {
        done: false,
        succeeded: false,
        mentions: [],
        status: run.status,
      };
    }

    const cached = getCachedVpsRun(runId);
    const expected = run.count ?? cached?.mentions.length ?? 0;
    if (
      cached &&
      cached.mentions.length > 0 &&
      (expected === 0 || cached.mentions.length >= expected)
    ) {
      return { ...cached, done: true };
    }

    const items = await loadAllVpsRunItems(run);
    const mentions = parseVpsMentions(platform, items);
    const succeeded = run.status === "completed" || mentions.length > 0;
    const payload: CachedVpsRun = {
      done: true,
      succeeded,
      mentions,
      status: run.status,
    };
    cacheVpsRun(runId, payload);
    return payload;
  } catch (err) {
    console.warn("[vps-run-resolver] gagal load run", runId, err);
    const cached = getCachedVpsRun(runId);
    if (cached) return { ...cached, done: true };
    return {
      done: true,
      succeeded: false,
      mentions: [],
      status: "failed",
    };
  }
}

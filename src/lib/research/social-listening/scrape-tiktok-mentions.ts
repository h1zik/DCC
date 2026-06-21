import "server-only";

import { SocialListeningPlatform } from "@prisma/client";
import {
  buildClockworksTikTokInput,
  parseTikTokScraperItems,
} from "@/lib/research/trend-radar/tiktok-trends";
import {
  fetchApifyDataset,
  getApifyRunStatus,
  isApifyConfigured,
  startApifyActor,
  waitForApifyRun,
} from "@/lib/apify/client";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";
import { isScraperApiConfigured } from "@/lib/scraper-api/client";
import { resolveVpsCachedRun } from "@/lib/scraper-api/vps-run-resolver";
import {
  expandInstagramHashtagCandidates,
  runVpsTikTokHashtag,
  runVpsTikTokSearch,
} from "@/lib/scraper-api/social-mentions";
import { cacheVpsRun, getCachedVpsRun } from "@/lib/scraper-api/vps-run-cache";
import { DEFAULT_TIKTOK_SEARCH_LIMIT } from "@/lib/research/social-listening/search-limits-public";

function getTikTokActorId(): string | null {
  return process.env.APIFY_ACTOR_TIKTOK_TRENDS?.trim() || null;
}

export function isTikTokMentionsConfigured(): boolean {
  if (isScraperApiConfigured()) return true;
  return isApifyConfigured() && !!getTikTokActorId();
}

function useVpsTikTok(): boolean {
  return isScraperApiConfigured();
}

function itemId(item: Record<string, unknown>): string {
  if (typeof item.id === "string") return item.id;
  if (typeof item.webVideoUrl === "string") return item.webVideoUrl;
  const authorMeta = item.authorMeta as Record<string, unknown> | undefined;
  const text = typeof item.text === "string" ? item.text : "";
  return `${authorMeta?.name ?? "unknown"}-${text.slice(0, 40)}`;
}

function playCountOf(item: Record<string, unknown>): number {
  if (typeof item.playCount === "number") return item.playCount;
  if (typeof item.views === "number") return item.views;
  const meta = item.videoMeta as Record<string, unknown> | undefined;
  if (meta && typeof meta.playCount === "number") return meta.playCount;
  return 0;
}

function pickHttpUrl(value: unknown): string | undefined {
  if (typeof value === "string" && value.startsWith("http")) return value;
  return undefined;
}

function pickTikTokThumbnail(item: Record<string, unknown>): string | undefined {
  const videoMeta = item.videoMeta as Record<string, unknown> | undefined;
  const covers = item.covers as Record<string, unknown> | undefined;

  return (
    pickHttpUrl(videoMeta?.coverUrl) ??
    pickHttpUrl(videoMeta?.cover) ??
    pickHttpUrl(covers?.default) ??
    pickHttpUrl(item.dynamicCover) ??
    pickHttpUrl(item.cover)
  );
}

function isTikTokVideo(item: Record<string, unknown>): boolean {
  return (
    typeof item.webVideoUrl === "string" ||
    typeof item.videoUrl === "string" ||
    item.isVideo === true ||
    !!(item.videoMeta && typeof item.videoMeta === "object")
  );
}

export function parseTikTokMentionItems(
  items: Record<string, unknown>[],
): RawSocialMention[] {
  const mentions: RawSocialMention[] = [];

  for (const item of items) {
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!text) continue;

    const authorMeta = item.authorMeta as Record<string, unknown> | undefined;
    const author =
      typeof authorMeta?.name === "string"
        ? authorMeta.name
        : typeof item.author === "string"
          ? item.author
          : undefined;

    const url =
      typeof item.webVideoUrl === "string"
        ? item.webVideoUrl
        : typeof item.url === "string"
          ? item.url
          : undefined;

    const createTime =
      typeof item.createTime === "number"
        ? new Date(item.createTime * 1000)
        : typeof item.createTimeISO === "string"
          ? new Date(item.createTimeISO)
          : undefined;

    mentions.push({
      platform: SocialListeningPlatform.TIKTOK,
      externalId: itemId(item),
      text,
      author,
      url,
      likes:
        typeof item.diggCount === "number"
          ? item.diggCount
          : typeof item.likes === "number"
            ? item.likes
            : 0,
      comments:
        typeof item.commentCount === "number"
          ? item.commentCount
          : typeof item.comments === "number"
            ? item.comments
            : 0,
      views: playCountOf(item),
      postedAt:
        createTime && !Number.isNaN(createTime.getTime()) ? createTime : undefined,
      thumbnailUrl: pickTikTokThumbnail(item),
      mediaType: isTikTokVideo(item) ? "video" : "image",
    });
  }

  return mentions;
}

function buildTikTokInput(
  keywords: string[],
  searchLimit: number,
): Record<string, unknown> | null {
  const actorId = getTikTokActorId();
  if (!actorId || keywords.length === 0) return null;

  const hashtags = keywords.map((k) => k.replace(/^#/, "").replace(/\s+/g, ""));
  const searchQueries = keywords.map((k) => k.trim()).filter(Boolean);

  return {
    ...buildClockworksTikTokInput(hashtags.slice(0, 5), searchLimit),
    searchQueries: searchQueries.slice(0, 5),
    resultsPerPage: searchLimit,
  };
}

function tikTokSearchVariants(keyword: string): string[] {
  const raw = keyword.trim();
  if (!raw) return [];

  const variants = new Set<string>();
  variants.add(raw);
  const noHash = raw.replace(/^#/, "").trim();
  if (noHash) variants.add(noHash);
  const compact = noHash.replace(/\s+/g, "");
  if (compact && compact.toLowerCase() !== noHash.toLowerCase()) {
    variants.add(compact);
  }
  return [...variants];
}

function dedupeTikTokMentions(mentions: RawSocialMention[]): RawSocialMention[] {
  const seen = new Map<string, RawSocialMention>();
  for (const m of mentions) {
    const key = m.externalId || m.url || m.text.slice(0, 80);
    if (!seen.has(key)) seen.set(key, m);
  }
  return [...seen.values()];
}

export async function startTikTokScrape(
  keywords: string[],
  opts?: { searchLimit?: number },
): Promise<{ runId: string; warnings?: string[] } | null> {
  const searchLimit = opts?.searchLimit ?? DEFAULT_TIKTOK_SEARCH_LIMIT;
  const scrapeWarnings: string[] = [];

  if (useVpsTikTok()) {
    const searchQueries = keywords.map((k) => k.trim()).filter(Boolean).slice(0, 5);
    if (searchQueries.length === 0) return null;

    let allMentions: RawSocialMention[] = [];
    let lastRunId = "";

    for (const keyword of searchQueries) {
      if (allMentions.length >= searchLimit) break;

      const variants = tikTokSearchVariants(keyword);
      for (const query of variants) {
        if (allMentions.length >= searchLimit) break;

        const remaining = searchLimit - allMentions.length;
        const result = await runVpsTikTokSearch(query, remaining);
        lastRunId = result.runId;
        allMentions = dedupeTikTokMentions([
          ...allMentions,
          ...result.mentions,
        ]).slice(0, searchLimit);
      }

      if (allMentions.length < searchLimit) {
        for (const tag of expandInstagramHashtagCandidates(keyword)) {
          if (allMentions.length >= searchLimit) break;

          const remaining = searchLimit - allMentions.length;
          let hashtagResult = await runVpsTikTokHashtag(tag, remaining);
          lastRunId = hashtagResult.runId;
          allMentions = dedupeTikTokMentions([
            ...allMentions,
            ...hashtagResult.mentions,
          ]).slice(0, searchLimit);
        }
      }
    }

    if (!lastRunId) return null;

    if (allMentions.length < searchLimit) {
      scrapeWarnings.push(
        `TikTok: total ${allMentions.length} video terkumpul dari limit ${searchLimit} — coba keyword/hashtag lain jika perlu lebih banyak.`,
      );
    }

    cacheVpsRun(lastRunId, {
      done: true,
      succeeded: allMentions.length > 0,
      mentions: allMentions,
      status: "completed",
    });

    return scrapeWarnings.length > 0
      ? { runId: lastRunId, warnings: scrapeWarnings }
      : { runId: lastRunId };
  }

  const actorId = getTikTokActorId();
  const input = buildTikTokInput(keywords, searchLimit);
  if (!actorId || !input) return null;

  const { runId } = await startApifyActor(actorId, input);
  return { runId };
}

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);

export async function pollTikTokScrape(runId: string): Promise<{
  done: boolean;
  succeeded: boolean;
  mentions: RawSocialMention[];
  apifyStatus: string;
}> {
  if (isScraperApiConfigured()) {
    const loaded = await resolveVpsCachedRun(
      runId,
      SocialListeningPlatform.TIKTOK,
    );
    return {
      done: loaded.done,
      succeeded: loaded.succeeded || loaded.mentions.length > 0,
      mentions: loaded.mentions,
      apifyStatus: loaded.status,
    };
  }

  const cached = getCachedVpsRun(runId);
  if (cached) {
    return {
      done: cached.done,
      succeeded: cached.succeeded,
      mentions: cached.mentions,
      apifyStatus: cached.status,
    };
  }

  const { status, datasetId } = await getApifyRunStatus(runId);
  if (!TERMINAL.has(status)) {
    return { done: false, succeeded: false, mentions: [], apifyStatus: status };
  }

  if (status !== "SUCCEEDED") {
    return { done: true, succeeded: false, mentions: [], apifyStatus: status };
  }

  const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
  const hashtags: string[] = [];
  parseTikTokScraperItems(items, hashtags);
  return {
    done: true,
    succeeded: true,
    mentions: parseTikTokMentionItems(items),
    apifyStatus: status,
  };
}

/** Blocking scrape — kept for backwards compatibility. */
export async function scrapeTikTokMentions(
  keywords: string[],
  opts?: { searchLimit?: number },
): Promise<RawSocialMention[]> {
  const started = await startTikTokScrape(keywords, opts);
  if (!started) return [];

  if (useVpsTikTok()) {
    const cached = getCachedVpsRun(started.runId);
    return cached?.mentions ?? [];
  }

  try {
    const { status, datasetId } = await waitForApifyRun(started.runId, {
      maxWaitMs: 300_000,
      pollIntervalMs: 5_000,
    });

    if (status !== "SUCCEEDED") {
      console.warn("[social-listening/tiktok] run gagal:", status);
      return [];
    }

    const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
    const hashtags = keywords.map((k) => k.replace(/^#/, "").replace(/\s+/g, ""));
    parseTikTokScraperItems(items, hashtags);
    return parseTikTokMentionItems(items);
  } catch (err) {
    console.warn("[social-listening/tiktok] gagal", err);
    return [];
  }
}

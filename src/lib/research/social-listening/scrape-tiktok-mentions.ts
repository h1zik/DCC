import "server-only";

import { SocialListeningPlatform } from "@prisma/client";
import {
  buildClockworksTikTokInput,
  parseTikTokScraperItems,
} from "@/lib/research/trend-radar/tiktok-trends";
import {
  fetchApifyDataset,
  isApifyConfigured,
  startApifyActor,
  waitForApifyRun,
} from "@/lib/apify/client";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";

function getTikTokActorId(): string | null {
  return process.env.APIFY_ACTOR_TIKTOK_TRENDS?.trim() || null;
}

export function isTikTokMentionsConfigured(): boolean {
  return isApifyConfigured() && !!getTikTokActorId();
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

function parseTikTokMentionItems(
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
      postedAt: createTime && !Number.isNaN(createTime.getTime()) ? createTime : undefined,
    });
  }

  return mentions;
}

export async function scrapeTikTokMentions(
  keywords: string[],
): Promise<RawSocialMention[]> {
  const actorId = getTikTokActorId();
  if (!actorId || keywords.length === 0) return [];

  const hashtags = keywords.map((k) => k.replace(/^#/, "").replace(/\s+/g, ""));
  const searchQueries = keywords.map((k) => k.trim()).filter(Boolean);

  try {
    const input = {
      ...buildClockworksTikTokInput(hashtags.slice(0, 5)),
      searchQueries: searchQueries.slice(0, 5),
      resultsPerPage: 15,
    };

    const { runId } = await startApifyActor(actorId, input);
    const { status, datasetId } = await waitForApifyRun(runId, {
      maxWaitMs: 300_000,
      pollIntervalMs: 5_000,
    });

    if (status !== "SUCCEEDED") {
      console.warn("[social-listening/tiktok] run gagal:", status);
      return [];
    }

    const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
    parseTikTokScraperItems(items, hashtags);
    return parseTikTokMentionItems(items);
  } catch (err) {
    console.warn("[social-listening/tiktok] gagal", err);
    return [];
  }
}

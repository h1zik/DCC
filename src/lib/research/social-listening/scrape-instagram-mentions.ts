import "server-only";

import { SocialListeningPlatform } from "@prisma/client";
import {
  fetchApifyDataset,
  isApifyConfigured,
  startApifyActor,
  waitForApifyRun,
} from "@/lib/apify/client";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";

function getInstagramActorId(): string | null {
  return process.env.APIFY_ACTOR_INSTAGRAM?.trim() || null;
}

export function isInstagramMentionsConfigured(): boolean {
  return isApifyConfigured() && !!getInstagramActorId();
}

function itemId(item: Record<string, unknown>): string {
  if (typeof item.id === "string") return item.id;
  if (typeof item.shortCode === "string") return item.shortCode;
  if (typeof item.url === "string") return item.url;
  const caption = typeof item.caption === "string" ? item.caption : "";
  return `ig-${caption.slice(0, 40)}`;
}

function parseInstagramItems(
  items: Record<string, unknown>[],
): RawSocialMention[] {
  const mentions: RawSocialMention[] = [];

  for (const item of items) {
    const text =
      (typeof item.caption === "string" ? item.caption : "") ||
      (typeof item.text === "string" ? item.text : "");
    const trimmed = text.trim();
    if (!trimmed) continue;

    const ownerMeta = item.owner as Record<string, unknown> | undefined;
    const owner =
      item.ownerUsername ??
      (ownerMeta && typeof ownerMeta.username === "string"
        ? ownerMeta.username
        : undefined) ??
      item.username;
    const author = typeof owner === "string" ? owner : undefined;

    const url =
      typeof item.url === "string"
        ? item.url
        : typeof item.shortCode === "string"
          ? `https://www.instagram.com/p/${item.shortCode}/`
          : undefined;

    const timestamp =
      typeof item.timestamp === "string"
        ? new Date(item.timestamp)
        : typeof item.takenAtTimestamp === "number"
          ? new Date(item.takenAtTimestamp * 1000)
          : undefined;

    mentions.push({
      platform: SocialListeningPlatform.INSTAGRAM,
      externalId: itemId(item),
      text: trimmed,
      author,
      url,
      likes:
        typeof item.likesCount === "number"
          ? item.likesCount
          : typeof item.likes === "number"
            ? item.likes
            : 0,
      comments:
        typeof item.commentsCount === "number"
          ? item.commentsCount
          : typeof item.comments === "number"
            ? item.comments
            : 0,
      views:
        typeof item.videoViewCount === "number"
          ? item.videoViewCount
          : typeof item.views === "number"
            ? item.views
            : 0,
      postedAt:
        timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : undefined,
    });
  }

  return mentions;
}

export async function scrapeInstagramMentions(
  keywords: string[],
): Promise<RawSocialMention[]> {
  const actorId = getInstagramActorId();
  if (!actorId || keywords.length === 0) return [];

  const allMentions: RawSocialMention[] = [];

  for (const keyword of keywords.slice(0, 5)) {
    const tag = keyword.replace(/^#/, "").replace(/\s+/g, "").toLowerCase();
    if (!tag) continue;

    try {
      const input = {
        search: tag,
        searchType: "hashtag",
        resultsLimit: 15,
        addParentData: false,
      };

      const { runId } = await startApifyActor(actorId, input);
      const { status, datasetId } = await waitForApifyRun(runId, {
        maxWaitMs: 300_000,
        pollIntervalMs: 5_000,
      });

      if (status !== "SUCCEEDED") {
        console.warn("[social-listening/instagram] run gagal:", status, tag);
        continue;
      }

      const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
      allMentions.push(...parseInstagramItems(items));
    } catch (err) {
      console.warn("[social-listening/instagram] gagal", tag, err);
    }
  }

  return allMentions;
}

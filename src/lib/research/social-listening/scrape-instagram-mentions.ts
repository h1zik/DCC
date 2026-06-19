import "server-only";

import { SocialListeningPlatform } from "@prisma/client";
import {
  fetchApifyDataset,
  getApifyRunStatus,
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

function flattenInstagramItems(
  items: Record<string, unknown>[],
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];

  for (const item of items) {
    const caption =
      typeof item.caption === "string" ? item.caption.trim() : "";
    if (caption) {
      out.push(item);
      continue;
    }

    const latestPosts = item.latestPosts;
    if (Array.isArray(latestPosts)) {
      for (const post of latestPosts) {
        if (post && typeof post === "object") {
          out.push(post as Record<string, unknown>);
        }
      }
    }
  }

  return out;
}

function pickHttpUrl(value: unknown): string | undefined {
  if (typeof value === "string" && value.startsWith("http")) return value;
  return undefined;
}

function pickInstagramThumbnail(item: Record<string, unknown>): string | undefined {
  const images = item.images;
  if (Array.isArray(images)) {
    for (const img of images) {
      const url = pickHttpUrl(img);
      if (url) return url;
      if (img && typeof img === "object") {
        const nested = pickHttpUrl((img as Record<string, unknown>).url);
        if (nested) return nested;
      }
    }
  }

  const childPosts = item.childPosts;
  if (Array.isArray(childPosts)) {
    for (const child of childPosts) {
      if (child && typeof child === "object") {
        const url = pickInstagramThumbnail(child as Record<string, unknown>);
        if (url) return url;
      }
    }
  }

  return (
    pickHttpUrl(item.displayUrl) ??
    pickHttpUrl(item.thumbnailUrl) ??
    pickHttpUrl(item.imageUrl) ??
    pickHttpUrl(item.previewUrl)
  );
}

function isInstagramVideo(item: Record<string, unknown>): boolean {
  return (
    item.isVideo === true ||
    typeof item.videoUrl === "string" ||
    (typeof item.type === "string" && item.type.toLowerCase().includes("video"))
  );
}

export function parseInstagramItems(
  items: Record<string, unknown>[],
): RawSocialMention[] {
  const mentions: RawSocialMention[] = [];

  for (const item of flattenInstagramItems(items)) {
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
      thumbnailUrl: pickInstagramThumbnail(item),
      mediaType: isInstagramVideo(item) ? "video" : "image",
    });
  }

  return mentions;
}

function instagramTags(keywords: string[]): string[] {
  return keywords
    .slice(0, 5)
    .map((k) => k.replace(/^#/, "").replace(/\s+/g, "").toLowerCase())
    .filter(Boolean);
}

export async function startInstagramScrapes(
  keywords: string[],
): Promise<string[]> {
  const actorId = getInstagramActorId();
  const tags = instagramTags(keywords);
  if (!actorId || tags.length === 0) return [];

  const runIds = await Promise.all(
    tags.map(async (tag) => {
      const input = {
        directUrls: [`https://www.instagram.com/explore/tags/${tag}/`],
        resultsType: "posts",
        resultsLimit: 15,
        addParentData: false,
      };
      const { runId } = await startApifyActor(actorId, input);
      return runId;
    }),
  );

  return runIds;
}

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]);

export async function pollInstagramScrapes(runIds: string[]): Promise<{
  done: boolean;
  succeeded: boolean;
  mentions: RawSocialMention[];
  apifyStatuses: string[];
}> {
  if (runIds.length === 0) {
    return { done: true, succeeded: false, mentions: [], apifyStatuses: [] };
  }

  const statuses = await Promise.all(runIds.map((id) => getApifyRunStatus(id)));
  const apifyStatuses = statuses.map((s) => s.status);
  const allDone = apifyStatuses.every((s) => TERMINAL.has(s));

  if (!allDone) {
    return {
      done: false,
      succeeded: false,
      mentions: [],
      apifyStatuses,
    };
  }

  const mentions: RawSocialMention[] = [];
  let succeeded = false;

  for (const { status, datasetId } of statuses) {
    if (status !== "SUCCEEDED") continue;
    succeeded = true;
    const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
    mentions.push(...parseInstagramItems(items));
  }

  return { done: true, succeeded, mentions, apifyStatuses };
}

/** Blocking scrape — kept for backwards compatibility. */
export async function scrapeInstagramMentions(
  keywords: string[],
): Promise<RawSocialMention[]> {
  const runIds = await startInstagramScrapes(keywords);
  if (runIds.length === 0) return [];

  const allMentions: RawSocialMention[] = [];

  for (const runId of runIds) {
    try {
      const { status, datasetId } = await waitForApifyRun(runId, {
        maxWaitMs: 300_000,
        pollIntervalMs: 5_000,
      });

      if (status !== "SUCCEEDED") {
        console.warn("[social-listening/instagram] run gagal:", status);
        continue;
      }

      const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
      allMentions.push(...parseInstagramItems(items));
    } catch (err) {
      console.warn("[social-listening/instagram] gagal", err);
    }
  }

  return allMentions;
}

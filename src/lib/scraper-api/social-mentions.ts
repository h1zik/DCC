import "server-only";

import { SocialListeningPlatform } from "@prisma/client";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";
import type { RawSocialComment } from "@/lib/research/social-listening/social-comment-types";
import {
  isScraperApiConfigured,
  loadAllVpsRunItems,
  startVpsActorRun,
} from "@/lib/scraper-api/client";

const DEFAULT_LIMIT = 20;

function socialCountry(): "id" | "all" {
  const raw = process.env.SCRAPER_API_SOCIAL_COUNTRY?.trim().toLowerCase();
  return raw === "all" ? "all" : "id";
}

function pickString(item: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickNumber(item: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function parseTimestamp(raw: unknown): Date | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const ms = raw > 1_000_000_000_000 ? raw : raw * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  if (typeof raw === "string" && raw.trim()) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

async function readVpsRunItems(
  run: Awaited<ReturnType<typeof startVpsActorRun>>,
): Promise<Record<string, unknown>[]> {
  return loadAllVpsRunItems(run);
}

export function parseVpsTikTokMentionItems(
  items: Record<string, unknown>[],
): RawSocialMention[] {
  const mentions: RawSocialMention[] = [];

  for (const item of items) {
    if (item.comment_id != null || item.commentId != null) continue;

    const text =
      pickString(item, ["caption", "text", "description", "title"]) ?? "";
    if (!text) continue;

    const externalId =
      pickString(item, ["video_id", "videoId", "id"]) ??
      pickString(item, ["post_url", "postUrl", "url"]) ??
      `tt-${mentions.length}`;

    mentions.push({
      platform: SocialListeningPlatform.TIKTOK,
      externalId,
      text,
      author: pickString(item, ["owner_username", "ownerUsername", "author"]) ?? undefined,
      url: pickString(item, ["post_url", "postUrl", "url", "webVideoUrl"]) ?? undefined,
      likes: pickNumber(item, ["likes", "diggCount"]),
      comments: pickNumber(item, ["comments_count", "commentCount", "comments"]),
      views: pickNumber(item, ["views", "playCount"]),
      postedAt: parseTimestamp(item.timestamp ?? item.createTime),
      thumbnailUrl:
        pickString(item, ["image_url", "imageUrl", "thumbnailUrl"]) ?? undefined,
      mediaType: "video",
    });
  }

  return mentions;
}

export function parseVpsInstagramMentionItems(
  items: Record<string, unknown>[],
): RawSocialMention[] {
  const mentions: RawSocialMention[] = [];

  for (const item of items) {
    if (item.comment_id != null || item.commentId != null) continue;

    const text = pickString(item, ["caption", "text"]) ?? "";
    if (!text) continue;

    const shortcode = pickString(item, ["shortcode", "shortCode"]);
    const externalId =
      pickString(item, ["post_id", "postId", "id"]) ??
      shortcode ??
      `ig-${mentions.length}`;

    const url =
      pickString(item, ["post_url", "postUrl", "url"]) ??
      (shortcode ? `https://www.instagram.com/p/${shortcode}/` : undefined);

    const mediaTypeRaw = pickString(item, ["media_type", "mediaType"])?.toLowerCase();
    const isReel = item.is_reel === true || item.isReel === true;
    const isVideo =
      isReel ||
      mediaTypeRaw?.includes("video") ||
      mediaTypeRaw === "reel" ||
      !!pickString(item, ["video_url", "videoUrl"]);

    mentions.push({
      platform: SocialListeningPlatform.INSTAGRAM,
      externalId,
      text,
      author:
        pickString(item, ["owner_username", "ownerUsername", "username"]) ??
        undefined,
      url,
      likes: pickNumber(item, ["likes", "likesCount"]),
      comments: pickNumber(item, ["comments_count", "commentsCount", "comments"]),
      views: pickNumber(item, ["views", "videoViewCount"]),
      postedAt: parseTimestamp(item.timestamp ?? item.takenAtTimestamp),
      thumbnailUrl:
        pickString(item, ["image_url", "imageUrl", "displayUrl", "thumbnailUrl"]) ??
        undefined,
      mediaType: isVideo ? "video" : "image",
    });
  }

  return mentions;
}

function normalizeHashtag(keyword: string): string {
  return keyword.replace(/^#/, "").replace(/\s+/g, "").toLowerCase();
}

/** Variasi hashtag dari keyword — mis. "Lip Tint" → liptint + lip_tint */
export function expandInstagramHashtagCandidates(keyword: string): string[] {
  const raw = keyword.trim();
  if (!raw) return [];

  const tags = new Set<string>();
  tags.add(normalizeHashtag(raw));
  const underscored = raw.replace(/^#/, "").replace(/\s+/g, "_").toLowerCase();
  if (underscored) tags.add(underscored);

  return [...tags];
}

function dedupeSocialMentions(
  mentions: RawSocialMention[],
): RawSocialMention[] {
  const seen = new Map<string, RawSocialMention>();
  for (const m of mentions) {
    const key = `${m.platform}:${m.externalId}`;
    if (!seen.has(key)) seen.set(key, m);
  }
  return [...seen.values()];
}

async function scrapeInstagramHashtagOnce(
  tag: string,
  limit: number,
  countryCode: "id" | "all",
): Promise<{
  runId: string;
  status: string;
  error: string | null;
  mentions: RawSocialMention[];
}> {
  const run = await startVpsActorRun(
    "instagram-hashtag",
    {
      hashtag: tag,
      limit,
      sort_by: "likes",
      country: countryCode,
      download_images: false,
    },
    { wait: true, timeout: 900, throwOnFailed: false },
  );

  const items = await readVpsRunItems(run);
  const mentions = parseVpsInstagramMentionItems(items);

  return {
    runId: run.run_id,
    status: run.status,
    error: run.error ?? null,
    mentions,
  };
}

export async function runVpsInstagramHashtag(
  keyword: string,
  limit = DEFAULT_LIMIT,
): Promise<{
  runId: string;
  mentions: RawSocialMention[];
  status: string;
  warning?: string;
}> {
  const tags = expandInstagramHashtagCandidates(keyword);
  const primaryCountry = socialCountry();
  let lastRunId = "";
  let lastError: string | null = null;
  let allMentions: RawSocialMention[] = [];
  let usedCountryFallback = false;

  for (const tag of tags) {
    if (allMentions.length >= limit) break;

    const remaining = limit - allMentions.length;
    let attempt = await scrapeInstagramHashtagOnce(tag, remaining, primaryCountry);

    if (
      attempt.mentions.length < remaining &&
      primaryCountry === "id"
    ) {
      const retry = await scrapeInstagramHashtagOnce(tag, remaining, "all");
      if (retry.mentions.length > attempt.mentions.length) {
        attempt = retry;
        usedCountryFallback = true;
      } else if (!lastError && retry.error && attempt.mentions.length === 0) {
        lastError = retry.error;
      }
    }

    if (attempt.runId) lastRunId = attempt.runId;
    if (attempt.error && attempt.mentions.length === 0) {
      lastError = attempt.error;
    }

    allMentions = dedupeSocialMentions([
      ...allMentions,
      ...attempt.mentions,
    ]).slice(0, limit);
  }

  const warning =
    usedCountryFallback && allMentions.length > 0
      ? `Instagram "${keyword}": hasil Indonesia sedikit — melengkapi dari hashtag global (country=all).`
      : lastError && allMentions.length === 0
        ? lastError
        : undefined;

  return {
    runId: lastRunId || `ig-empty-${normalizeHashtag(keyword)}`,
    mentions: allMentions,
    status: allMentions.length > 0 ? "completed" : "failed",
    warning,
  };
}

export async function runVpsTikTokSearch(
  keyword: string,
  limit = DEFAULT_LIMIT,
  countryCode?: "id" | "all",
): Promise<{ runId: string; mentions: RawSocialMention[]; status: string }> {
  const run = await startVpsActorRun(
    "tiktok-search",
    {
      keyword: keyword.trim(),
      limit,
      sort_by: "views",
      country: countryCode ?? socialCountry(),
      download_images: false,
    },
    { wait: true, timeout: 900, throwOnFailed: false },
  );

  const items = await readVpsRunItems(run);
  const mentions = parseVpsTikTokMentionItems(items);
  const succeeded =
    run.status === "completed" || mentions.length > 0;

  return {
    runId: run.run_id,
    mentions,
    status: succeeded ? "completed" : run.status,
  };
}

export async function runVpsTikTokHashtag(
  hashtag: string,
  limit = DEFAULT_LIMIT,
  countryCode?: "id" | "all",
): Promise<{ runId: string; mentions: RawSocialMention[]; status: string }> {
  const run = await startVpsActorRun(
    "tiktok-hashtag",
    {
      hashtag: normalizeHashtag(hashtag),
      limit,
      sort_by: "views",
      country: countryCode ?? socialCountry(),
      download_images: false,
    },
    { wait: true, timeout: 900, throwOnFailed: false },
  );

  const items = await readVpsRunItems(run);
  const mentions = parseVpsTikTokMentionItems(items);
  const succeeded =
    run.status === "completed" || mentions.length > 0;

  return {
    runId: run.run_id,
    mentions,
    status: succeeded ? "completed" : run.status,
  };
}

export function parseVpsSocialComments(
  items: Record<string, unknown>[],
  platform: SocialListeningPlatform,
  parentExternalId: string,
): RawSocialComment[] {
  const out: RawSocialComment[] = [];

  for (const item of items) {
    const text = pickString(item, ["text", "comment", "content"]) ?? "";
    if (!text) continue;

    out.push({
      platform,
      parentExternalId,
      externalId:
        pickString(item, ["comment_id", "commentId", "id"]) ??
        `${parentExternalId}-c-${out.length}`,
      text,
      author:
        pickString(item, ["author_username", "authorUsername", "username"]) ??
        undefined,
      likes: pickNumber(item, ["likes"]),
      postedAt: parseTimestamp(item.created_at ?? item.timestamp),
    });
  }

  return out;
}

function isTransientVpsSocialError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("invalid response") ||
    message.includes("Failed to load TikTok") ||
    message.includes("timeout") ||
    message.includes("ECONNRESET") ||
    message.includes("502") ||
    message.includes("503")
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchVpsTikTokVideoComments(
  postUrl: string,
  parentExternalId: string,
  limit = 50,
): Promise<RawSocialComment[]> {
  const maxAttempts = 3;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const run = await startVpsActorRun(
      "tiktok-video",
      {
        video_url: postUrl,
        include_comments: true,
        comment_limit: limit,
        download_images: false,
      },
      { wait: true, timeout: 300, throwOnFailed: false },
    );

    if (run.status !== "failed") {
      const items = await readVpsRunItems(run);
      return parseVpsSocialComments(
        items,
        SocialListeningPlatform.TIKTOK,
        parentExternalId,
      );
    }

    lastError = run.error ?? "Scrape VPS gagal tanpa pesan error.";
    if (attempt < maxAttempts && isTransientVpsSocialError(new Error(lastError))) {
      await sleep(2_000 * attempt);
      continue;
    }
    break;
  }

  console.warn(
    "[social-listening/tt-comments/vps] gagal",
    postUrl,
    lastError ?? "unknown",
  );
  return [];
}

export async function fetchVpsInstagramPostComments(
  postUrl: string,
  parentExternalId: string,
  limit = 50,
): Promise<RawSocialComment[]> {
  const run = await startVpsActorRun(
    "instagram-post",
    {
      post_url: postUrl,
      include_comments: true,
      comment_limit: limit,
      download_images: false,
    },
    { wait: true, timeout: 300 },
  );

  const items = await readVpsRunItems(run);
  return parseVpsSocialComments(
    items,
    SocialListeningPlatform.INSTAGRAM,
    parentExternalId,
  );
}

export function isVpsSocialListeningConfigured(): boolean {
  return isScraperApiConfigured();
}

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
import { extractEmbeddedComments } from "@/lib/research/social-listening/parse-embedded-comments";
import { isScraperApiConfigured } from "@/lib/scraper-api/client";
import {
  expandInstagramHashtagCandidates,
  runVpsInstagramHashtag,
} from "@/lib/scraper-api/social-mentions";
import { resolveVpsCachedRun } from "@/lib/scraper-api/vps-run-resolver";
import { cacheVpsRun } from "@/lib/scraper-api/vps-run-cache";
import { DEFAULT_INSTAGRAM_SEARCH_LIMIT } from "@/lib/research/social-listening/search-limits-public";

function getInstagramActorId(): string | null {
  return process.env.APIFY_ACTOR_INSTAGRAM?.trim() || null;
}

/**
 * Run id fallback Apify diberi prefix ini supaya poll/blocking tahu harus
 * mengambil hasil dari Apify (bukan cache VPS) walau VPS dikonfigurasi.
 */
const APIFY_FALLBACK_PREFIX = "apify:";

function apifyInstagramInput(tag: string, limit: number): Record<string, unknown> {
  return {
    directUrls: [`https://www.instagram.com/explore/tags/${tag}/`],
    resultsType: "posts",
    resultsLimit: limit,
    addParentData: false,
  };
}

export function isInstagramMentionsConfigured(): boolean {
  if (isScraperApiConfigured()) return true;
  return isApifyConfigured() && !!getInstagramActorId();
}

function vpsInstagramEnabled(): boolean {
  return isScraperApiConfigured();
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
      scrapedComments: extractEmbeddedComments(
        item,
        SocialListeningPlatform.INSTAGRAM,
        itemId(item),
        15,
      ),
    });
  }

  return mentions;
}

function instagramTags(keywords: string[]): string[] {
  const tags = new Set<string>();
  for (const keyword of keywords.slice(0, 5)) {
    for (const tag of expandInstagramHashtagCandidates(keyword)) {
      tags.add(tag);
    }
  }
  return [...tags];
}

export async function startInstagramScrapes(
  keywords: string[],
  opts?: { searchLimit?: number },
): Promise<{ runIds: string[]; warnings: string[] }> {
  const tags = instagramTags(keywords);
  if (tags.length === 0) return { runIds: [], warnings: [] };

  const searchLimit = opts?.searchLimit ?? DEFAULT_INSTAGRAM_SEARCH_LIMIT;
  const warnings: string[] = [];

  if (vpsInstagramEnabled()) {
    const runIds: string[] = [];

    for (const keyword of keywords.slice(0, 5)) {
      const result = await runVpsInstagramHashtag(keyword, searchLimit);
      if (result.warning) warnings.push(result.warning);
      if (result.mentions.length < searchLimit) {
        warnings.push(
          `Instagram "${keyword}": ${result.mentions.length} post dari limit ${searchLimit}.`,
        );
      }

      cacheVpsRun(result.runId, {
        done: true,
        succeeded: result.mentions.length > 0,
        mentions: result.mentions,
        status: result.status,
      });
      if (result.mentions.length > 0 && result.runId) {
        runIds.push(result.runId);
      }
    }

    // Fallback: VPS Instagram tidak mengembalikan apa pun (kemungkinan akun/sesi
    // IG di VPS diblok/checkpoint) → coba Apify yang punya sesi + proxy sendiri.
    const fallbackActor = getInstagramActorId();
    if (runIds.length === 0 && isApifyConfigured() && fallbackActor) {
      try {
        const apifyRunIds = await Promise.all(
          tags.map(async (tag) => {
            const { runId } = await startApifyActor(
              fallbackActor,
              apifyInstagramInput(tag, searchLimit),
            );
            return `${APIFY_FALLBACK_PREFIX}${runId}`;
          }),
        );
        runIds.push(...apifyRunIds);
        warnings.push(
          "VPS Instagram balik 0 (kemungkinan akun/sesi IG di VPS diblok) — fallback ke Apify.",
        );
      } catch (err) {
        console.warn("[social-listening/instagram] fallback Apify gagal", err);
      }
    }

    return { runIds, warnings };
  }

  const actorId = getInstagramActorId();
  if (!actorId) return { runIds: [], warnings: [] };

  const runIds = await Promise.all(
    tags.map(async (tag) => {
      const { runId } = await startApifyActor(
        actorId,
        apifyInstagramInput(tag, searchLimit),
      );
      return runId;
    }),
  );

  return { runIds, warnings: [] };
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

  // Run ber-prefix "apify:" adalah fallback Apify — diambil dari Apify walau VPS
  // dikonfigurasi (lebih robust lintas-proses karena run tersimpan di server Apify).
  const apifyFallback = runIds.some((id) =>
    id.startsWith(APIFY_FALLBACK_PREFIX),
  );

  if (vpsInstagramEnabled() && !apifyFallback) {
    const mentions: RawSocialMention[] = [];
    const apifyStatuses: string[] = [];
    let succeeded = false;
    const seen = new Set<string>();

    for (const runId of runIds) {
      const loaded = await resolveVpsCachedRun(
        runId,
        SocialListeningPlatform.INSTAGRAM,
      );
      apifyStatuses.push(loaded.status);
      if (loaded.succeeded) succeeded = true;
      for (const m of loaded.mentions) {
        const key = `${m.platform}:${m.externalId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        mentions.push(m);
      }
    }

    return {
      done: true,
      succeeded: succeeded || mentions.length > 0,
      mentions,
      apifyStatuses: apifyStatuses.length > 0 ? apifyStatuses : ["completed"],
    };
  }

  const apifyIds = runIds.map((id) =>
    id.startsWith(APIFY_FALLBACK_PREFIX)
      ? id.slice(APIFY_FALLBACK_PREFIX.length)
      : id,
  );
  const statuses = await Promise.all(apifyIds.map((id) => getApifyRunStatus(id)));
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
  opts?: { searchLimit?: number },
): Promise<RawSocialMention[]> {
  const started = await startInstagramScrapes(keywords, opts);
  const runIds = started.runIds;
  if (runIds.length === 0) return [];

  const apifyFallback = runIds.some((id) =>
    id.startsWith(APIFY_FALLBACK_PREFIX),
  );

  // VPS murni (tanpa fallback): hasil sudah tersedia di cache, baca langsung.
  if (vpsInstagramEnabled() && !apifyFallback) {
    const result = await pollInstagramScrapes(runIds);
    return result.mentions;
  }

  // Apify (env tanpa VPS, ATAU fallback Apify) — tunggu run selesai lalu ambil.
  const apifyIds = runIds.map((id) =>
    id.startsWith(APIFY_FALLBACK_PREFIX)
      ? id.slice(APIFY_FALLBACK_PREFIX.length)
      : id,
  );
  const allMentions: RawSocialMention[] = [];

  for (const runId of apifyIds) {
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

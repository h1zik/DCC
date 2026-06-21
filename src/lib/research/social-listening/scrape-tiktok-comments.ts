import "server-only";

import { SocialListeningPlatform } from "@prisma/client";
import {
  fetchApifyDataset,
  isApifyConfigured,
  startApifyActor,
  waitForApifyRun,
} from "@/lib/apify/client";
import { isScraperApiConfigured } from "@/lib/scraper-api/client";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";
import type { RawSocialComment } from "@/lib/research/social-listening/social-comment-types";
import { sanitizePrismaText } from "@/lib/prisma-safe-string";

export const DEFAULT_TIKTOK_COMMENTS_ACTOR = "clockworks~tiktok-comments-scraper";
export const TIKTOK_COMMENTS_PER_POST = 50;
export const TOP_POSTS_FOR_TT_COMMENTS = 3;
/** Per-video Apify wait — batch besar sering >5 menit dan hang di video viral. */
export const TIKTOK_COMMENT_RUN_TIMEOUT_MS = 180_000;

export function getTikTokCommentsActorId(): string {
  return (
    process.env.APIFY_ACTOR_TIKTOK_COMMENTS?.trim() ||
    DEFAULT_TIKTOK_COMMENTS_ACTOR
  );
}

export function isTikTokCommentsConfigured(): boolean {
  if (isScraperApiConfigured()) return true;
  return isApifyConfigured() && !!getTikTokCommentsActorId();
}

export function normalizeTikTokVideoUrl(url: string): string {
  const base = url.split("?")[0]?.trim().toLowerCase() ?? url.toLowerCase();
  try {
    const parsed = new URL(base.startsWith("http") ? base : `https://${base}`);
    return parsed.pathname.replace(/\/+$/, "");
  } catch {
    return base.replace(/\/+$/, "");
  }
}

/** URL bersih tanpa query/hash — lebih stabil untuk clockworks comments-scraper. */
export function canonicalTikTokVideoUrl(url: string): string {
  const base = url.split("?")[0]?.split("#")[0]?.trim() ?? url.trim();
  try {
    const parsed = new URL(base.startsWith("http") ? base : `https://${base}`);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return base.replace(/\/+$/, "");
  }
}

function engagementScore(m: RawSocialMention): number {
  return m.likes + m.comments * 2 + Math.floor(m.views / 100);
}

/** Top video TikTok yang punya commentCount > 0 — hindari run Apify sia-sia. */
export function pickTikTokPostsForCommentScrape(
  mentions: RawSocialMention[],
  limit = TOP_POSTS_FOR_TT_COMMENTS,
): RawSocialMention[] {
  return mentions
    .filter(
      (m) =>
        m.platform === SocialListeningPlatform.TIKTOK &&
        m.comments > 0 &&
        !!m.url?.includes("tiktok.com"),
    )
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, limit);
}

export function buildTikTokCommentsInput(
  postURLs: string[],
  commentsPerPost = TIKTOK_COMMENTS_PER_POST,
): Record<string, unknown> {
  return {
    postURLs,
    commentsPerPost,
    topLevelCommentsPerPost: commentsPerPost,
    maxRepliesPerComment: 0,
  };
}

export function parseTikTokCommentItems(
  items: Record<string, unknown>[],
  parentByVideoUrl: Map<string, string>,
): RawSocialComment[] {
  const out: RawSocialComment[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (item.errorCode != null) continue;

    const text = sanitizePrismaText(
      typeof item.text === "string" ? item.text : "",
    );
    if (!text || text.length < 3) continue;

    const videoUrl =
      typeof item.videoWebUrl === "string"
        ? item.videoWebUrl
        : typeof item.webVideoUrl === "string"
          ? item.webVideoUrl
          : "";
    if (!videoUrl) continue;

    const parentExternalId = parentByVideoUrl.get(
      normalizeTikTokVideoUrl(videoUrl),
    );
    if (!parentExternalId) continue;

    const dedupeKey = `${parentExternalId}:${text.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const author =
      typeof item.uniqueId === "string"
        ? item.uniqueId
        : typeof item.author === "string"
          ? item.author
          : undefined;

    const cid =
      typeof item.cid === "string" || typeof item.cid === "number"
        ? String(item.cid)
        : "";

    const likes =
      typeof item.diggCount === "number"
        ? item.diggCount
        : typeof item.likes === "number"
          ? item.likes
          : 0;

    const postedAt =
      typeof item.createTimeISO === "string"
        ? new Date(item.createTimeISO)
        : typeof item.createTime === "number"
          ? new Date(item.createTime * 1000)
          : undefined;

    out.push({
      platform: SocialListeningPlatform.TIKTOK,
      externalId: cid ? `tt-${cid}` : `tt-${i}-${author ?? "anon"}`,
      text,
      author,
      likes,
      postedAt:
        postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : undefined,
      parentExternalId,
    });
  }

  return out;
}

export async function scrapeTikTokCommentsForPosts(
  mentions: RawSocialMention[],
  opts?: { commentsPerPost?: number },
): Promise<{ comments: RawSocialComment[]; warnings: string[] }> {
  const warnings: string[] = [];
  if (!isTikTokCommentsConfigured()) {
    return { comments: [], warnings };
  }

  const posts = mentions.filter(
    (m) =>
      m.platform === SocialListeningPlatform.TIKTOK &&
      !!m.url?.includes("tiktok.com"),
  );
  if (posts.length === 0) return { comments: [], warnings };

  const parentByVideoUrl = new Map<string, string>();
  const postURLs: string[] = [];

  for (const mention of posts) {
    const url = canonicalTikTokVideoUrl(mention.url!);
    const normalized = normalizeTikTokVideoUrl(url);
    if (parentByVideoUrl.has(normalized)) continue;
    parentByVideoUrl.set(normalized, mention.externalId);
    postURLs.push(url);
  }

  if (postURLs.length === 0) return { comments: [], warnings };

  const commentsPerPost = opts?.commentsPerPost ?? TIKTOK_COMMENTS_PER_POST;
  const actorId = getTikTokCommentsActorId();
  warnings.push(
    `TikTok komentar: ${postURLs.length} video via ${actorId.replace("~", "/")} (max ${commentsPerPost}/video).`,
  );
  const allItems: Record<string, unknown>[] = [];
  let timedOutRuns = 0;
  let failedRuns = 0;
  let emptyRuns = 0;

  for (const url of postURLs) {
    try {
      const { runId } = await startApifyActor(
        actorId,
        buildTikTokCommentsInput([url], commentsPerPost),
      );
      const { status, datasetId } = await waitForApifyRun(runId, {
        maxWaitMs: TIKTOK_COMMENT_RUN_TIMEOUT_MS,
        pollIntervalMs: 4_000,
      });

      if (status === "SUCCEEDED") {
        const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
        allItems.push(...items);
        if (items.length === 0) {
          emptyRuns += 1;
          warnings.push(
            `TikTok komentar: 0 hasil untuk ${normalizeTikTokVideoUrl(url)} (run sukses, dataset kosong).`,
          );
        }
        continue;
      }

      failedRuns += 1;
      console.warn(
        `[social-listening/tiktok-comments] run ${runId} selesai ${status} untuk ${url}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("batas waktu")) {
        timedOutRuns += 1;
        warnings.push(
          `TikTok komentar: timeout 3 menit untuk satu video — run Apify mungkin masih jalan di console.`,
        );
      } else {
        failedRuns += 1;
        console.warn("[social-listening/tiktok-comments] gagal", url, err);
      }
    }
  }

  if (timedOutRuns > 0) {
    warnings.push(
      `${timedOutRuns} scrape komentar TikTok melebihi batas waktu — kurangi video viral / cek run di Apify Console.`,
    );
  }
  if (emptyRuns > 0 && allItems.length > 0) {
    warnings.push(
      `${emptyRuns} video TikTok tidak mengembalikan komentar meski commentCount > 0.`,
    );
  }
  if (failedRuns > 0 && allItems.length === 0) {
    warnings.push(
      "TikTok komentar: semua run gagal — coba refresh atau periksa URL video.",
    );
  }
  if (emptyRuns > 0 && allItems.length === 0) {
    warnings.push(
      "TikTok komentar: semua run kosong — komentar mungkin dibatasi TikTok atau URL tidak bisa di-scrape.",
    );
  }

  return {
    comments: parseTikTokCommentItems(allItems, parentByVideoUrl),
    warnings,
  };
}

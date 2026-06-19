import "server-only";

import { SocialListeningPlatform } from "@prisma/client";
import {
  fetchApifyDataset,
  isApifyConfigured,
  startApifyActor,
  waitForApifyRun,
} from "@/lib/apify/client";
import type { RawSocialMention } from "@/lib/research/social-listening/collect-mentions";
import type { RawSocialComment } from "@/lib/research/social-listening/social-comment-types";
import { extractEmbeddedComments } from "@/lib/research/social-listening/parse-embedded-comments";
import {
  isTikTokCommentsConfigured,
  scrapeTikTokCommentsForPosts,
  TIKTOK_COMMENTS_PER_POST,
  TOP_POSTS_FOR_TT_COMMENTS,
} from "@/lib/research/social-listening/scrape-tiktok-comments";

const TOP_POSTS_FOR_IG_COMMENTS = 5;
const IG_COMMENTS_PER_POST = 25;

function engagementScore(m: RawSocialMention): number {
  return m.likes + m.comments * 2 + Math.floor(m.views / 100);
}

function flattenEmbedded(
  mentions: RawSocialMention[],
  platform?: SocialListeningPlatform,
): RawSocialComment[] {
  const out: RawSocialComment[] = [];
  for (const m of mentions) {
    if (platform && m.platform !== platform) continue;
    if (m.scrapedComments?.length) {
      out.push(...m.scrapedComments);
    }
  }
  return out;
}

function parseInstagramCommentItems(
  items: Record<string, unknown>[],
  parentExternalId: string,
): RawSocialComment[] {
  return extractEmbeddedComments(
    { comments: items },
    SocialListeningPlatform.INSTAGRAM,
    parentExternalId,
    IG_COMMENTS_PER_POST,
  );
}

async function scrapeInstagramPostComments(
  mention: RawSocialMention,
): Promise<RawSocialComment[]> {
  const actorId = process.env.APIFY_ACTOR_INSTAGRAM?.trim();
  if (!actorId || !mention.url?.includes("instagram.com")) return [];

  try {
    const { runId } = await startApifyActor(actorId, {
      directUrls: [mention.url],
      resultsType: "comments",
      resultsLimit: IG_COMMENTS_PER_POST,
    });
    const { status, datasetId } = await waitForApifyRun(runId, {
      maxWaitMs: 120_000,
      pollIntervalMs: 4_000,
    });
    if (status !== "SUCCEEDED") return [];

    const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
    return parseInstagramCommentItems(items, mention.externalId);
  } catch (err) {
    console.warn("[social-listening/ig-comments] gagal", mention.url, err);
    return [];
  }
}

/** Collect comment texts: TikTok deep-fetch (Clockworks) + IG embedded/deep-fetch. */
export async function collectPostComments(
  mentions: RawSocialMention[],
): Promise<{ comments: RawSocialComment[]; warnings: string[] }> {
  const warnings: string[] = [];
  const comments: RawSocialComment[] = [];

  comments.push(
    ...flattenEmbedded(mentions, SocialListeningPlatform.INSTAGRAM),
  );

  const topTikTokPosts = mentions
    .filter(
      (m) =>
        m.platform === SocialListeningPlatform.TIKTOK &&
        !!m.url?.includes("tiktok.com"),
    )
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, TOP_POSTS_FOR_TT_COMMENTS);

  if (isTikTokCommentsConfigured() && topTikTokPosts.length > 0) {
    const { comments: tiktokComments, warnings: ttWarnings } =
      await scrapeTikTokCommentsForPosts(topTikTokPosts, {
        commentsPerPost: TIKTOK_COMMENTS_PER_POST,
      });
    warnings.push(...ttWarnings);

    if (tiktokComments.length > 0) {
      comments.push(...tiktokComments);
      warnings.push(
        `TikTok: ${tiktokComments.length} komentar dari comments-scraper (${topTikTokPosts.length} video).`,
      );
    } else {
      warnings.push(
        "TikTok: tidak ada teks komentar — cek run clockworks/tiktok-comments-scraper di Apify Console.",
      );
    }
  } else {
    if (
      topTikTokPosts.length > 0 &&
      !isTikTokCommentsConfigured() &&
      isApifyConfigured()
    ) {
      warnings.push(
        "TikTok: set APIFY_ACTOR_TIKTOK_COMMENTS (clockworks~tiktok-comments-scraper) untuk deep-fetch komentar.",
      );
    }
    comments.push(...flattenEmbedded(mentions, SocialListeningPlatform.TIKTOK));
  }

  const igWithoutComments = mentions
    .filter(
      (m) =>
        m.platform === SocialListeningPlatform.INSTAGRAM &&
        m.comments > 0 &&
        !(m.scrapedComments?.length),
    )
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, TOP_POSTS_FOR_IG_COMMENTS);

  if (
    igWithoutComments.length > 0 &&
    isApifyConfigured() &&
    process.env.APIFY_ACTOR_INSTAGRAM?.trim()
  ) {
    let igDeepFetchAdded = 0;
    for (const post of igWithoutComments) {
      const scraped = await scrapeInstagramPostComments(post);
      if (scraped.length > 0) {
        igDeepFetchAdded += scraped.length;
        comments.push(...scraped);
      }
    }
    if (
      igDeepFetchAdded === 0 &&
      flattenEmbedded(mentions, SocialListeningPlatform.INSTAGRAM).length === 0
    ) {
      warnings.push(
        "Instagram: komentar teks belum terkumpul — scrape post saja tanpa thread komentar.",
      );
    }
  }

  const seen = new Set<string>();
  const deduped = comments.filter((c) => {
    const key = `${c.platform}:${c.parentExternalId}:${c.text.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { comments: deduped, warnings };
}

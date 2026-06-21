import "server-only";

import { SocialListeningPlatform } from "@prisma/client";
import { generateDemoMentions } from "@/lib/research/social-listening/demo-mentions";
import { scrapeInstagramMentions } from "@/lib/research/social-listening/scrape-instagram-mentions";
import {
  isTikTokMentionsConfigured,
  scrapeTikTokMentions,
} from "@/lib/research/social-listening/scrape-tiktok-mentions";
import { isInstagramMentionsConfigured } from "@/lib/research/social-listening/scrape-instagram-mentions";

export type RawSocialMention = {
  platform: SocialListeningPlatform;
  externalId: string;
  text: string;
  author?: string;
  url?: string;
  likes: number;
  comments: number;
  views: number;
  postedAt?: Date;
  thumbnailUrl?: string;
  mediaType?: "image" | "video";
  /** Comment texts scraped alongside the post (TikTok commentsPerPost, IG fetch). */
  scrapedComments?: import("@/lib/research/social-listening/social-comment-types").RawSocialComment[];
};

export type CollectMentionsResult = {
  mentions: RawSocialMention[];
  usedDemo: boolean;
  warnings: string[];
  /** Jumlah mention per platform setelah scrape (sebelum demo fallback). */
  platformCounts: Partial<Record<SocialListeningPlatform, number>>;
};

function dedupeMentions(mentions: RawSocialMention[]): RawSocialMention[] {
  const seen = new Set<string>();
  const out: RawSocialMention[] = [];

  for (const m of mentions) {
    const key = `${m.platform}:${m.externalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }

  return out;
}

function countByPlatform(
  mentions: RawSocialMention[],
): Partial<Record<SocialListeningPlatform, number>> {
  const counts: Partial<Record<SocialListeningPlatform, number>> = {};
  for (const m of mentions) {
    counts[m.platform] = (counts[m.platform] ?? 0) + 1;
  }
  return counts;
}

export async function collectMentions(input: {
  keywords: string[];
  platforms: SocialListeningPlatform[];
}): Promise<CollectMentionsResult> {
  const warnings: string[] = [];
  const batches: RawSocialMention[][] = [];

  if (input.platforms.includes(SocialListeningPlatform.TIKTOK)) {
    if (isTikTokMentionsConfigured()) {
      const tiktok = await scrapeTikTokMentions(input.keywords);
      if (tiktok.length === 0) {
        warnings.push("TikTok: scrape selesai tapi tidak ada mention ditemukan.");
      }
      batches.push(tiktok);
    } else {
      warnings.push(
        "TikTok Apify belum dikonfigurasi — lewati platform TikTok.",
      );
    }
  }

  if (input.platforms.includes(SocialListeningPlatform.INSTAGRAM)) {
    if (isInstagramMentionsConfigured()) {
      const instagram = await scrapeInstagramMentions(input.keywords);
      if (instagram.length === 0) {
        warnings.push(
          "Instagram: scrape selesai tapi tidak ada post ditemukan untuk keyword/hashtag ini.",
        );
      }
      batches.push(instagram);
    } else {
      warnings.push(
        "Instagram scraper belum dikonfigurasi — lewati platform Instagram.",
      );
    }
  }

  let mentions = dedupeMentions(batches.flat());
  const platformCounts = countByPlatform(mentions);
  let usedDemo = false;

  if (mentions.length === 0) {
    mentions = generateDemoMentions(input.keywords, input.platforms);
    usedDemo = true;
    warnings.push("Menggunakan data demo karena scrape kosong atau API tidak tersedia.");
  }

  return { mentions, usedDemo, warnings, platformCounts };
}

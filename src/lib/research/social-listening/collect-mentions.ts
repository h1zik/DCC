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
};

export type CollectMentionsResult = {
  mentions: RawSocialMention[];
  usedDemo: boolean;
  warnings: string[];
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

export async function collectMentions(input: {
  keywords: string[];
  platforms: SocialListeningPlatform[];
}): Promise<CollectMentionsResult> {
  const warnings: string[] = [];
  const tasks: Promise<RawSocialMention[]>[] = [];

  if (input.platforms.includes(SocialListeningPlatform.TIKTOK)) {
    if (isTikTokMentionsConfigured()) {
      tasks.push(scrapeTikTokMentions(input.keywords));
    } else {
      warnings.push("TikTok Apify belum dikonfigurasi — lewati platform TikTok.");
    }
  }

  if (input.platforms.includes(SocialListeningPlatform.INSTAGRAM)) {
    if (isInstagramMentionsConfigured()) {
      tasks.push(scrapeInstagramMentions(input.keywords));
    } else {
      warnings.push(
        "APIFY_ACTOR_INSTAGRAM belum diset — lewati platform Instagram.",
      );
    }
  }

  const batches = await Promise.all(tasks);
  let mentions = dedupeMentions(batches.flat());
  let usedDemo = false;

  if (mentions.length === 0) {
    mentions = generateDemoMentions(input.keywords, input.platforms);
    usedDemo = true;
    if (warnings.length > 0) {
      warnings.push("Menggunakan data demo karena scrape kosong atau API tidak tersedia.");
    }
  }

  return { mentions, usedDemo, warnings };
}

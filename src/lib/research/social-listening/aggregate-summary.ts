import "server-only";

import { SocialMentionClass } from "@prisma/client";
import type { ClassifiedMention } from "@/lib/research/social-listening/mention-analyzer";

export type PainPointRow = {
  theme: string;
  count: number;
  sampleText: string;
};

export type WishlistRow = {
  theme: string;
  count: number;
  sampleText: string;
};

export type InfluencerRow = {
  author: string;
  platform: string;
  mentions: number;
  totalEngagement: number;
  topUrl: string | null;
};

export type ViralContentRow = {
  text: string;
  author: string | null;
  platform: string;
  url: string | null;
  views: number;
  likes: number;
};

export type CategoryBreakdownRow = {
  classification: string;
  count: number;
  pct: number;
};

export type SocialSummaryData = {
  topPainPoints: PainPointRow[];
  topWishlist: WishlistRow[];
  influencers: InfluencerRow[];
  viralContent: ViralContentRow[];
  categoryBreakdown: CategoryBreakdownRow[];
};

function engagement(m: ClassifiedMention): number {
  return m.likes + m.comments * 2 + Math.floor(m.views / 100);
}

function themeKey(text: string): string {
  return text.trim().slice(0, 80).toLowerCase();
}

export function aggregateSocialSummary(
  mentions: ClassifiedMention[],
): SocialSummaryData {
  const painMap = new Map<string, { count: number; sample: string }>();
  const wishMap = new Map<string, { count: number; sample: string }>();
  const authorMap = new Map<
    string,
    {
      author: string;
      platform: string;
      mentions: number;
      engagement: number;
      topUrl: string | null;
      topEngagement: number;
    }
  >();
  const classCounts = new Map<string, number>();

  for (const m of mentions) {
    classCounts.set(
      m.classification,
      (classCounts.get(m.classification) ?? 0) + 1,
    );

    if (
      m.classification === SocialMentionClass.COMPLAINT &&
      m.painPoint
    ) {
      const key = themeKey(m.painPoint);
      const prev = painMap.get(key) ?? { count: 0, sample: m.painPoint };
      painMap.set(key, { count: prev.count + 1, sample: prev.sample });
    }

    if (
      m.classification === SocialMentionClass.WISHLIST &&
      m.painPoint
    ) {
      const key = themeKey(m.painPoint);
      const prev = wishMap.get(key) ?? { count: 0, sample: m.painPoint };
      wishMap.set(key, { count: prev.count + 1, sample: prev.sample });
    }

    if (m.author) {
      const key = `${m.platform}:${m.author}`;
      const eng = engagement(m);
      const prev = authorMap.get(key) ?? {
        author: m.author,
        platform: m.platform,
        mentions: 0,
        engagement: 0,
        topUrl: m.url ?? null,
        topEngagement: 0,
      };
      authorMap.set(key, {
        ...prev,
        mentions: prev.mentions + 1,
        engagement: prev.engagement + eng,
        topUrl: eng > prev.topEngagement ? (m.url ?? prev.topUrl) : prev.topUrl,
        topEngagement: Math.max(prev.topEngagement, eng),
      });
    }
  }

  const total = mentions.length || 1;

  const viralContent = mentions
    .filter((m) => m.isViral)
    .sort((a, b) => b.views - a.views || b.likes - a.likes)
    .slice(0, 10)
    .map((m) => ({
      text: m.text.slice(0, 200),
      author: m.author ?? null,
      platform: m.platform,
      url: m.url ?? null,
      views: m.views,
      likes: m.likes,
    }));

  return {
    topPainPoints: [...painMap.entries()]
      .map(([theme, v]) => ({
        theme: v.sample,
        count: v.count,
        sampleText: v.sample,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topWishlist: [...wishMap.entries()]
      .map(([theme, v]) => ({
        theme: v.sample,
        count: v.count,
        sampleText: v.sample,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    influencers: [...authorMap.values()]
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 15)
      .map((a) => ({
        author: a.author,
        platform: a.platform,
        mentions: a.mentions,
        totalEngagement: a.engagement,
        topUrl: a.topUrl,
      })),
    viralContent,
    categoryBreakdown: [...classCounts.entries()].map(([classification, count]) => ({
      classification,
      count,
      pct: Math.round((count / total) * 1000) / 10,
    })),
  };
}

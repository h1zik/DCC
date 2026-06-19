import "server-only";

import { SocialMentionClass } from "@prisma/client";
import type { ClassifiedMention } from "@/lib/research/social-listening/mention-analyzer";
import type {
  ClassifiedComment,
  EngagementInsights,
} from "@/lib/research/social-listening/social-comment-types";

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

export type SentimentDayRow = {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
};

export type SocialSummaryData = {
  topPainPoints: PainPointRow[];
  topWishlist: WishlistRow[];
  influencers: InfluencerRow[];
  viralContent: ViralContentRow[];
  categoryBreakdown: CategoryBreakdownRow[];
  sentimentTimeline: SentimentDayRow[];
  topCommentPainPoints: PainPointRow[];
  topCommentWishlist: WishlistRow[];
  commentCategoryBreakdown: CategoryBreakdownRow[];
  engagementInsights: EngagementInsights;
};

const POSITIVE_CLASSES = new Set<string>([
  SocialMentionClass.PRAISE,
  SocialMentionClass.RECOMMENDATION,
]);
const NEGATIVE_CLASSES = new Set<string>([SocialMentionClass.COMPLAINT]);

function buildSentimentTimeline(
  mentions: ClassifiedMention[],
): SentimentDayRow[] {
  const byDay = new Map<
    string,
    { positive: number; negative: number; neutral: number }
  >();

  for (const m of mentions) {
    if (!m.postedAt) continue;
    const date = new Date(m.postedAt).toISOString().slice(0, 10);
    const row = byDay.get(date) ?? { positive: 0, negative: 0, neutral: 0 };
    if (POSITIVE_CLASSES.has(m.classification)) row.positive += 1;
    else if (NEGATIVE_CLASSES.has(m.classification)) row.negative += 1;
    else row.neutral += 1;
    byDay.set(date, row);
  }

  return [...byDay.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function engagement(m: ClassifiedMention): number {
  return m.likes + m.comments * 2 + Math.floor(m.views / 100);
}

function themeKey(text: string): string {
  return text.trim().slice(0, 80).toLowerCase();
}

function buildThemeMap(
  items: { classification: string; painPoint: string | null }[],
  targetClass: SocialMentionClass,
): Map<string, { count: number; sample: string }> {
  const map = new Map<string, { count: number; sample: string }>();
  for (const m of items) {
    if (m.classification !== targetClass || !m.painPoint) continue;
    const key = themeKey(m.painPoint);
    const prev = map.get(key) ?? { count: 0, sample: m.painPoint };
    map.set(key, { count: prev.count + 1, sample: prev.sample });
  }
  return map;
}

function mapToThemeRows(
  map: Map<string, { count: number; sample: string }>,
  limit = 10,
): PainPointRow[] {
  return [...map.entries()]
    .map(([, v]) => ({
      theme: v.sample,
      count: v.count,
      sampleText: v.sample,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function buildCategoryBreakdown(
  items: { classification: string }[],
): CategoryBreakdownRow[] {
  const classCounts = new Map<string, number>();
  for (const m of items) {
    classCounts.set(m.classification, (classCounts.get(m.classification) ?? 0) + 1);
  }
  const total = items.length || 1;
  return [...classCounts.entries()].map(([classification, count]) => ({
    classification,
    count,
    pct: Math.round((count / total) * 1000) / 10,
  }));
}

function buildEngagementInsights(
  mentions: ClassifiedMention[],
  comments: ClassifiedComment[],
): EngagementInsights {
  const n = mentions.length || 1;
  const totalLikes = mentions.reduce((s, m) => s + m.likes, 0);
  const totalCommentCount = mentions.reduce((s, m) => s + m.comments, 0);
  const totalViews = mentions.reduce((s, m) => s + m.views, 0);

  return {
    totalMentions: mentions.length,
    totalCommentCount,
    scrapedCommentTexts: comments.length,
    avgLikes: Math.round(totalLikes / n),
    avgComments: Math.round(totalCommentCount / n),
    avgViews: Math.round(totalViews / n),
    commentToLikeRatio:
      totalLikes > 0
        ? Math.round((totalCommentCount / totalLikes) * 1000) / 1000
        : 0,
    highCommentPosts: mentions.filter((m) => m.comments >= 100).length,
  };
}

export function aggregateCommentSummary(
  comments: ClassifiedComment[],
): Pick<
  SocialSummaryData,
  "topCommentPainPoints" | "topCommentWishlist" | "commentCategoryBreakdown"
> {
  const painMap = buildThemeMap(comments, SocialMentionClass.COMPLAINT);
  const wishMap = buildThemeMap(comments, SocialMentionClass.WISHLIST);

  return {
    topCommentPainPoints: mapToThemeRows(painMap),
    topCommentWishlist: mapToThemeRows(wishMap),
    commentCategoryBreakdown: buildCategoryBreakdown(comments),
  };
}

export function aggregateSocialSummary(
  mentions: ClassifiedMention[],
  comments: ClassifiedComment[] = [],
): SocialSummaryData {
  const painMap = buildThemeMap(mentions, SocialMentionClass.COMPLAINT);
  const wishMap = buildThemeMap(mentions, SocialMentionClass.WISHLIST);
  const commentAgg = aggregateCommentSummary(comments);
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

  for (const m of mentions) {
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
    topPainPoints: mapToThemeRows(painMap),
    topWishlist: mapToThemeRows(wishMap),
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
    categoryBreakdown: buildCategoryBreakdown(mentions),
    sentimentTimeline: buildSentimentTimeline(mentions),
    ...commentAgg,
    engagementInsights: buildEngagementInsights(mentions, comments),
  };
}

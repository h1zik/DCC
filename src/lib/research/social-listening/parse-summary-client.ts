import type { EngagementInsights } from "@/lib/research/social-listening/social-comment-types";

export function parseEngagementInsights(raw: unknown): EngagementInsights | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<EngagementInsights>;
  if (typeof o.totalMentions !== "number") return null;
  return {
    totalMentions: o.totalMentions,
    totalCommentCount: o.totalCommentCount ?? 0,
    scrapedCommentTexts: o.scrapedCommentTexts ?? 0,
    avgLikes: o.avgLikes ?? 0,
    avgComments: o.avgComments ?? 0,
    avgViews: o.avgViews ?? 0,
    commentToLikeRatio: o.commentToLikeRatio ?? 0,
    highCommentPosts: o.highCommentPosts ?? 0,
  };
}

export function parseThemeRows(raw: unknown): { theme: string; count: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is { theme: string; count: number } =>
      !!x &&
      typeof x === "object" &&
      typeof (x as { theme?: unknown }).theme === "string" &&
      typeof (x as { count?: unknown }).count === "number",
  );
}

export function parseCategoryBreakdown(
  raw: unknown,
): { classification: string; count: number; pct: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is { classification: string; count: number; pct: number } =>
      !!x &&
      typeof x === "object" &&
      typeof (x as { classification?: unknown }).classification === "string",
  ) as { classification: string; count: number; pct: number }[];
}

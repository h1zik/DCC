import type { SocialListeningPlatform, SocialMentionClass } from "@prisma/client";

export type RawSocialComment = {
  platform: SocialListeningPlatform;
  externalId: string;
  text: string;
  author?: string;
  likes: number;
  postedAt?: Date;
  /** Parent post external id for linking before DB insert. */
  parentExternalId: string;
};

export type ClassifiedComment = RawSocialComment & {
  classification: SocialMentionClass;
  painPoint: string | null;
};

export type CommentThemeRow = {
  theme: string;
  count: number;
  sampleText: string;
  source: "comment";
};

export type EngagementInsights = {
  totalMentions: number;
  totalCommentCount: number;
  scrapedCommentTexts: number;
  avgLikes: number;
  avgComments: number;
  avgViews: number;
  commentToLikeRatio: number;
  highCommentPosts: number;
};

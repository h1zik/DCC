import type {
  InfluencerAuditStatus,
  InfluencerPlatform,
  InfluencerTier,
  InfluencerVerdict,
} from "@prisma/client";

export type PostView = {
  id: string;
  url: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  mediaType: string | null;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  saves: number;
  engagementRate: number;
  isSponsored: boolean;
  inSample: boolean;
  surface: string;
  isPinned: boolean;
  postedAt: string | null;
};

export type AuditView = {
  id: string;
  status: InfluencerAuditStatus;
  errorMessage: string | null;
  createdAt: string;
  collectedAt: string | null;
  followers: number;
  following: number;
  postCount: number;
  tier: InfluencerTier | null;
  postsFetched: number;
  postsAnalyzed: number;
  sampleWindowDays: number | null;
  confidence: string;
  medianLikes: number;
  medianComments: number;
  medianShares: number;
  medianViews: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgViews: number;
  engagementRate: number;
  totalEngagementRate: number;
  viewEngagementRate: number | null;
  viewRate: number | null;
  feedPostCount: number;
  reelsPostCount: number;
  reelsEngagementRate: number | null;
  postsPerWeek: number;
  daysSinceLastPost: number | null;
  sponsoredCount: number;
  organicCount: number;
  sponsoredEr: number | null;
  organicEr: number | null;
  sponsoredDeltaPct: number | null;
  expectedCampaignEr: number;
  score: number;
  verdict: InfluencerVerdict | null;
  benchmarkEr: number | null;
  authenticityScore: number;
  fakeFlags: unknown;
  metrics: unknown;
  aiSummary: string | null;
  posts: PostView[];
};

export type ProfileView = {
  id: string;
  platform: InfluencerPlatform;
  handle: string;
  profileUrl: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
  notes: string | null;
  brandName: string | null;
};

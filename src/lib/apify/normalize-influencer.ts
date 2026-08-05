import { InfluencerPlatform } from "@prisma/client";

export type NormalizedInfluencerPost = {
  externalId: string;
  url?: string;
  caption?: string;
  thumbnailUrl?: string;
  mediaType?: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  saves: number;
  postedAt?: Date;
  /** Penanda berbayar resmi dari platform (label paid partnership / isAd). */
  isSponsoredMeta?: boolean;
};

export type NormalizedInfluencerProfile = {
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  isVerified: boolean;
  isPrivate: boolean;
  followers: number;
  following: number;
  postCount: number;
  posts: NormalizedInfluencerPost[];
};

function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[,_\s]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function httpUrl(value: unknown): string | undefined {
  const s = str(value);
  return s && s.startsWith("http") ? s : undefined;
}

function bool(value: unknown): boolean {
  return value === true;
}

/** Terima ISO string, epoch detik, atau epoch milidetik. */
function toDate(value: unknown): Date | undefined {
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    // Epoch detik punya 10 digit; milidetik 13.
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function rec(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function normalizeInstagramPost(
  raw: Record<string, unknown>,
): NormalizedInfluencerPost | null {
  const shortCode = str(raw.shortCode);
  const externalId = str(raw.id) ?? shortCode;
  if (!externalId) return null;

  // videoPlayCount lebih dekat ke "reach" daripada videoViewCount.
  const views = Math.max(num(raw.videoPlayCount), num(raw.videoViewCount));

  return {
    externalId,
    url: httpUrl(raw.url) ?? (shortCode ? `https://www.instagram.com/p/${shortCode}/` : undefined),
    caption: str(raw.caption),
    thumbnailUrl: httpUrl(raw.displayUrl) ?? httpUrl(raw.thumbnailUrl),
    mediaType: str(raw.type) ?? str(raw.productType),
    likes: Math.max(num(raw.likesCount), 0),
    comments: Math.max(num(raw.commentsCount), 0),
    shares: 0, // Instagram tidak mengekspos share count publik.
    views: Math.max(views, 0),
    saves: 0,
    postedAt: toDate(raw.timestamp),
    isSponsoredMeta: bool(raw.isSponsored) || bool(raw.isPaidPartnership),
  };
}

/**
 * `apify/instagram-scraper` dengan resultsType "details" mengembalikan satu
 * objek profil berisi `latestPosts`. Kalau actor jatuh ke mode posts, item
 * datang sebagai daftar post datar — keduanya ditangani.
 */
export function normalizeInstagramProfile(
  items: Record<string, unknown>[],
  fallbackHandle: string,
): NormalizedInfluencerProfile {
  const profileItem =
    items.find((i) => Array.isArray(i.latestPosts)) ??
    items.find((i) => str(i.username)) ??
    items[0];

  if (!profileItem) {
    throw new Error(
      "Apify tidak mengembalikan data profil Instagram. Cek apakah akun ada dan tidak diblokir.",
    );
  }

  if (bool(profileItem.private)) {
    throw new Error(
      `Akun @${str(profileItem.username) ?? fallbackHandle} privat — engagement tidak bisa dihitung.`,
    );
  }

  const rawPosts = Array.isArray(profileItem.latestPosts)
    ? (profileItem.latestPosts as unknown[])
    : items.filter((i) => str(i.shortCode) || str(i.type));

  const posts = rawPosts
    .map((p) => rec(p))
    .filter((p): p is Record<string, unknown> => !!p)
    .map(normalizeInstagramPost)
    .filter((p): p is NormalizedInfluencerPost => !!p);

  return {
    handle: (str(profileItem.username) ?? fallbackHandle).toLowerCase(),
    displayName: str(profileItem.fullName),
    avatarUrl: httpUrl(profileItem.profilePicUrlHD) ?? httpUrl(profileItem.profilePicUrl),
    bio: str(profileItem.biography),
    isVerified: bool(profileItem.verified),
    isPrivate: false,
    followers: Math.max(num(profileItem.followersCount), 0),
    following: Math.max(num(profileItem.followsCount), 0),
    postCount: Math.max(num(profileItem.postsCount), posts.length),
    posts,
  };
}

function normalizeTikTokPost(
  raw: Record<string, unknown>,
): NormalizedInfluencerPost | null {
  const externalId = str(raw.id) ?? str(raw.webVideoUrl);
  if (!externalId) return null;

  const videoMeta = rec(raw.videoMeta);

  return {
    externalId,
    url: httpUrl(raw.webVideoUrl),
    caption: str(raw.text),
    thumbnailUrl: httpUrl(videoMeta?.coverUrl) ?? httpUrl(videoMeta?.cover),
    mediaType: "Video",
    likes: Math.max(num(raw.diggCount), 0),
    comments: Math.max(num(raw.commentCount), 0),
    shares: Math.max(num(raw.shareCount), 0),
    views: Math.max(num(raw.playCount), 0),
    saves: Math.max(num(raw.collectCount), 0),
    postedAt: toDate(raw.createTimeISO) ?? toDate(raw.createTime),
    isSponsoredMeta: bool(raw.isAd) || bool(raw.isSponsored),
  };
}

/**
 * `clockworks/tiktok-scraper` mengembalikan daftar video; data follower ada di
 * `authorMeta` yang menempel pada setiap video.
 */
export function normalizeTikTokProfile(
  items: Record<string, unknown>[],
  fallbackHandle: string,
): NormalizedInfluencerProfile {
  const videos = items.filter((i) => str(i.id) || str(i.webVideoUrl));
  const authorSource = items.find((i) => rec(i.authorMeta));
  const author = rec(authorSource?.authorMeta);

  if (!author && videos.length === 0) {
    // Actor memakai `error`/`errorMessage` untuk akun mati atau tidak ada.
    const notice =
      str(items[0]?.error) ??
      str(items[0]?.errorMessage) ??
      "Apify tidak mengembalikan video. Cek apakah akun TikTok ada dan punya video publik.";
    throw new Error(notice);
  }

  const posts = videos
    .map(normalizeTikTokPost)
    .filter((p): p is NormalizedInfluencerPost => !!p);

  return {
    handle: (str(author?.name) ?? fallbackHandle).toLowerCase(),
    displayName: str(author?.nickName),
    avatarUrl: httpUrl(author?.avatar),
    bio: str(author?.signature),
    isVerified: bool(author?.verified),
    isPrivate: bool(author?.privateAccount),
    followers: Math.max(num(author?.fans), 0),
    following: Math.max(num(author?.following), 0),
    postCount: Math.max(num(author?.video), posts.length),
    posts,
  };
}

export function normalizeInfluencerDataset(
  platform: InfluencerPlatform,
  items: Record<string, unknown>[],
  fallbackHandle: string,
): NormalizedInfluencerProfile {
  return platform === InfluencerPlatform.INSTAGRAM
    ? normalizeInstagramProfile(items, fallbackHandle)
    : normalizeTikTokProfile(items, fallbackHandle);
}

/** Batas scrape Social Listening — aman di-import dari komponen client. */
export const DEFAULT_TIKTOK_SEARCH_LIMIT = 20;
export const DEFAULT_INSTAGRAM_SEARCH_LIMIT = 20;
export const MAX_TIKTOK_SEARCH_LIMIT = 100;
export const MAX_INSTAGRAM_SEARCH_LIMIT = 100;

export type SocialListeningSearchLimits = {
  tiktok: number;
  instagram: number;
};

export function clampSocialSearchLimit(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(Math.floor(value), max);
}

export function parseSearchLimitInput(
  raw: string,
  fallback: number,
  max: number,
): number {
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return clampSocialSearchLimit(parsed, max);
}

export function resolveTikTokSearchLimit(stored?: number | null): number {
  if (stored != null && stored > 0) {
    return clampSocialSearchLimit(stored, MAX_TIKTOK_SEARCH_LIMIT);
  }
  return DEFAULT_TIKTOK_SEARCH_LIMIT;
}

export function resolveInstagramSearchLimit(stored?: number | null): number {
  if (stored != null && stored > 0) {
    return clampSocialSearchLimit(stored, MAX_INSTAGRAM_SEARCH_LIMIT);
  }
  return DEFAULT_INSTAGRAM_SEARCH_LIMIT;
}

export function resolveSearchLimits(monitor?: {
  tiktokSearchLimit?: number | null;
  instagramSearchLimit?: number | null;
}): SocialListeningSearchLimits {
  return {
    tiktok: resolveTikTokSearchLimit(monitor?.tiktokSearchLimit),
    instagram: resolveInstagramSearchLimit(monitor?.instagramSearchLimit),
  };
}

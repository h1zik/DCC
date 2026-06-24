export type AdLibraryMediaFields = {
  mediaType: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  snapshotUrl: string | null;
};

export type AdFormatFilter = "all" | "image" | "video";

/** Nilai `mediaType` yang dikirim ke Apify / disimpan di monitor. */
export type ScrapeMediaType = AdFormatFilter;

export const SCRAPE_MEDIA_TYPE_LABELS: Record<ScrapeMediaType, string> = {
  all: "Image + Video",
  image: "Image saja",
  video: "Video saja",
};

/** @deprecated Gunakan SCRAPE_MEDIA_TYPE_LABELS — filter format sekarang di level scrape. */
export const AD_FORMAT_FILTER_LABELS = SCRAPE_MEDIA_TYPE_LABELS;

/** True when URL is a direct image/CDN asset, not an Ad Library HTML page. */
export function isRenderableImageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const u = url.trim().toLowerCase();
  if (!u.startsWith("http")) return false;

  if (u.includes("facebook.com/ads/archive/render")) return false;
  if (u.includes("facebook.com/ads/library")) return false;
  if (u.includes("facebook.com/ads/archive/") && !u.includes("fbcdn")) return false;

  if (/\.(jpg|jpeg|png|gif|webp|avif|bmp)(\?|#|$)/i.test(u)) return true;
  if (u.includes("fbcdn.net") || u.includes("fbcdn.com")) return true;
  if (u.includes("scontent.") && u.includes("fbcdn")) return true;
  if (u.includes("cdninstagram.com")) return true;

  return !u.includes("facebook.com/") && !u.includes("instagram.com/");
}

export function isAdVideo(ad: AdLibraryMediaFields): boolean {
  if (ad.videoUrl?.trim()) return true;
  const mt = (ad.mediaType ?? "").toUpperCase();
  return mt === "VIDEO" || mt.includes("VIDEO");
}

export function isAdImageOnly(ad: AdLibraryMediaFields): boolean {
  return !isAdVideo(ad);
}

export function adPosterUrl(ad: AdLibraryMediaFields): string | null {
  if (isRenderableImageUrl(ad.imageUrl)) return ad.imageUrl!.trim();
  if (isRenderableImageUrl(ad.snapshotUrl)) return ad.snapshotUrl!.trim();
  return null;
}

export function matchesAdFormatFilter(
  ad: AdLibraryMediaFields,
  filter: AdFormatFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "video") return isAdVideo(ad);
  return isAdImageOnly(ad);
}

export function filterAdsByScrapeMediaType<T extends AdLibraryMediaFields>(
  ads: T[],
  mediaType: ScrapeMediaType,
): T[] {
  if (mediaType === "all") return ads;
  if (mediaType === "video") return ads.filter((ad) => isAdVideo(ad));
  return ads.filter((ad) => isAdImageOnly(ad));
}

export function scrapeMediaTypeLabel(mediaType: string | null | undefined): string {
  const key = (mediaType ?? "all") as ScrapeMediaType;
  return SCRAPE_MEDIA_TYPE_LABELS[key] ?? SCRAPE_MEDIA_TYPE_LABELS.all;
}
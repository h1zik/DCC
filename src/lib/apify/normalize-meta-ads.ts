import { isRenderableImageUrl } from "@/lib/brand-research/ad-library-media";

export type NormalizedMetaAd = {
  externalId: string;
  pageId: string | null;
  pageName: string | null;
  pageProfileUrl: string | null;
  bodyText: string | null;
  linkTitle: string | null;
  linkUrl: string | null;
  ctaType: string | null;
  ctaText: string | null;
  mediaType: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  snapshotUrl: string | null;
  platforms: string[];
  isActive: boolean;
  deliveryStart: Date | null;
  deliveryStop: Date | null;
  scrapedAt: Date | null;
  rawData: Record<string, unknown>;
};

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function firstStringFromArray(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sanitizeImageUrl(url: string | null): string | null {
  if (!url) return null;
  return isRenderableImageUrl(url) ? url.trim() : null;
}

function pickVideoThumbnail(raw: Record<string, unknown>): string | null {
  const preview = firstStringFromArray(
    raw.videoPreviewUrls ?? raw.video_preview_urls,
  );
  if (preview) return sanitizeImageUrl(preview);

  const nested = raw.snapshot ?? raw.ad_snapshot ?? raw.creative;
  if (nested && typeof nested === "object") {
    const nestedRaw = nested as Record<string, unknown>;
    const fromNested =
      sanitizeImageUrl(pickImageUrl(nestedRaw)) ??
      sanitizeImageUrl(pickVideoThumbnailFromVideosOnly(nestedRaw));
    if (fromNested) return fromNested;
  }

  return sanitizeImageUrl(pickVideoThumbnailFromVideosOnly(raw));
}

function pickVideoThumbnailFromVideosOnly(
  raw: Record<string, unknown>,
): string | null {
  const videos = raw.videos ?? raw.videoUrls ?? raw.video_urls;
  if (!Array.isArray(videos)) return null;

  for (const item of videos) {
    if (item && typeof item === "object") {
      const v = item as Record<string, unknown>;
      const url = firstString(
        v.video_preview_image_url,
        v.videoPreviewImageUrl,
        v.thumbnail_url,
        v.thumbnailUrl,
        v.preview_image_url,
        v.previewImageUrl,
        v.poster_url,
        v.posterUrl,
        v.image_url,
        v.imageUrl,
        v.picture,
      );
      if (url) return url;
    }
  }
  return null;
}

function pickImageUrl(raw: Record<string, unknown>): string | null {
  const direct = sanitizeImageUrl(
    firstString(raw.imageUrl, raw.image_url),
  );
  if (direct) return direct;

  const preview = pickVideoThumbnail(raw);
  if (preview) return preview;

  const images = raw.images ?? raw.imageUrls ?? raw.image_urls;
  if (Array.isArray(images)) {
    for (const item of images) {
      if (typeof item === "string") {
        const url = sanitizeImageUrl(item);
        if (url) return url;
      }
      if (item && typeof item === "object") {
        const url = sanitizeImageUrl(
          firstString(
            (item as Record<string, unknown>).url,
            (item as Record<string, unknown>).imageUrl,
            (item as Record<string, unknown>).image_url,
          ),
        );
        if (url) return url;
      }
    }
  }

  const cards = raw.cards;
  if (Array.isArray(cards)) {
    for (const card of cards) {
      if (card && typeof card === "object") {
        const c = card as Record<string, unknown>;
        const url = sanitizeImageUrl(firstString(c.imageUrl, c.image_url));
        if (url) return url;
      }
    }
  }
  return null;
}

function videoUrlFromObject(v: Record<string, unknown>): string | null {
  return firstString(
    v.url,
    v.video_hd_url,
    v.videoHdUrl,
    v.video_sd_url,
    v.videoSdUrl,
    v.src,
    v.playable_url,
    v.playableUrl,
  );
}

function videoUrlFromArray(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (typeof item === "string" && item.startsWith("http")) return item;
    if (item && typeof item === "object") {
      const url = videoUrlFromObject(item as Record<string, unknown>);
      if (url) return url;
    }
  }
  return null;
}

/**
 * Cari URL video. Meta Ad Library menaruh video di dalam `snapshot.videos[]`
 * (kadang `cards[]`), bukan di top-level — jadi kita rekursi ke nested object,
 * kalau tidak `videoUrl` selalu null dan video tampil sebagai gambar saja.
 */
function pickVideoUrl(raw: Record<string, unknown>): string | null {
  const direct = firstString(raw.videoUrl, raw.video_url);
  if (direct) return direct;

  const fromVideos = videoUrlFromArray(
    raw.videos ?? raw.videoUrls ?? raw.video_urls,
  );
  if (fromVideos) return fromVideos;

  const cards = raw.cards;
  if (Array.isArray(cards)) {
    for (const card of cards) {
      if (card && typeof card === "object") {
        const url = videoUrlFromObject(card as Record<string, unknown>);
        if (url) return url;
      }
    }
  }

  for (const key of ["snapshot", "ad_snapshot", "creative"]) {
    const nested = raw[key];
    if (nested && typeof nested === "object") {
      const nestedUrl = pickVideoUrl(nested as Record<string, unknown>);
      if (nestedUrl) return nestedUrl;
    }
  }

  return null;
}

function pickPlatforms(raw: Record<string, unknown>): string[] {
  const platforms = raw.publisher_platforms ?? raw.platforms;
  if (!Array.isArray(platforms)) return [];
  return platforms
    .map((p) => String(p).trim())
    .filter(Boolean);
}

export function normalizeMetaAdItem(
  item: Record<string, unknown>,
): NormalizedMetaAd | null {
  const externalId = firstString(
    item.ad_archive_id,
    item.adArchiveId,
    item.ad_archiveId,
    item.id,
  );
  if (!externalId) return null;

  const bodies = item.ad_creative_bodies ?? item.adCopy ?? item.bodyText;
  const bodyText =
    firstStringFromArray(bodies) ??
    (typeof bodies === "string" ? bodies : null);

  const linkTitles = item.ad_creative_link_titles ?? item.headline ?? item.title;
  const linkTitle =
    firstStringFromArray(linkTitles) ??
    (typeof linkTitles === "string" ? linkTitles : null);

  const linkUrls =
    item.ad_creative_link_urls ?? item.link_url ?? item.linkUrl ?? item.landingUrl;
  const linkUrl =
    firstStringFromArray(linkUrls) ??
    (typeof linkUrls === "string" ? linkUrls : null);

  const videoUrl = pickVideoUrl(item);
  let imageUrl = pickImageUrl(item);
  if (videoUrl && !imageUrl) {
    imageUrl = pickVideoThumbnail(item);
  }
  const mediaType =
    firstString(item.media_type, item.mediaType, item.displayFormat) ??
    (videoUrl ? "VIDEO" : imageUrl ? "IMAGE" : null);

  return {
    externalId,
    pageId: firstString(item.page_id, item.pageId),
    pageName: firstString(item.page_name, item.pageName),
    pageProfileUrl: firstString(item.page_profile_url, item.pageUrl, item.page_profileUrl),
    bodyText,
    linkTitle,
    linkUrl,
    ctaType: firstString(item.cta_type, item.ctaType),
    ctaText: firstString(item.cta_text, item.ctaText),
    mediaType: mediaType?.toUpperCase() ?? null,
    imageUrl,
    videoUrl,
    snapshotUrl: firstString(item.ad_snapshot_url, item.adLibraryUrl, item.snapshotUrl),
    platforms: pickPlatforms(item),
    isActive: item.is_active !== false && item.isActive !== false,
    deliveryStart: parseDate(
      item.ad_delivery_start_time ?? item.startDate ?? item.deliveryStart,
    ),
    deliveryStop: parseDate(
      item.ad_delivery_stop_time ?? item.endDate ?? item.deliveryStop,
    ),
    scrapedAt: parseDate(item.scrapedAt),
    rawData: item,
  };
}

export function normalizeMetaAds(
  items: Record<string, unknown>[],
): NormalizedMetaAd[] {
  const seen = new Set<string>();
  const result: NormalizedMetaAd[] = [];
  for (const item of items) {
    const normalized = normalizeMetaAdItem(item);
    if (!normalized || seen.has(normalized.externalId)) continue;
    seen.add(normalized.externalId);
    result.push(normalized);
  }
  return result;
}

/**
 * Backfill media dari raw Apify payload yang tersimpan:
 * - videoUrl: Meta menaruh video di `snapshot.videos[]` (nested), sering tidak
 *   ter-ekstrak pada data lama sehingga video tampil sebagai gambar saja.
 * - imageUrl/poster: bila imageUrl hilang atau bukan URL gambar yang bisa dirender.
 */
export function enrichAdMediaFromRaw<T extends {
  imageUrl: string | null;
  videoUrl: string | null;
  rawData?: unknown;
}>(ad: T): T {
  const raw =
    ad.rawData && typeof ad.rawData === "object"
      ? (ad.rawData as Record<string, unknown>)
      : null;

  let videoUrl = ad.videoUrl;
  if (!videoUrl?.trim() && raw) {
    videoUrl = pickVideoUrl(raw);
  }

  let imageUrl = ad.imageUrl;
  if (!isRenderableImageUrl(imageUrl)) {
    imageUrl = raw
      ? pickImageUrl(raw) ?? (videoUrl ? pickVideoThumbnail(raw) : null)
      : null;
  }

  if (videoUrl === ad.videoUrl && imageUrl === ad.imageUrl) return ad;
  return { ...ad, imageUrl, videoUrl };
}

export function generateDemoMetaAds(searchTerms: string[]): NormalizedMetaAd[] {
  const term = searchTerms[0] ?? "skincare";
  const now = new Date();
  return [
    {
      externalId: `demo-ad-${term}-1`,
      pageId: "demo-page-1",
      pageName: `Demo Brand ${term}`,
      pageProfileUrl: null,
      bodyText: `Temukan ${term} terbaik — formula ringan, hasil cepat terlihat.`,
      linkTitle: `Koleksi ${term} Baru`,
      linkUrl: "https://example.com",
      ctaType: "SHOP_NOW",
      ctaText: "Belanja sekarang",
      mediaType: "IMAGE",
      imageUrl: "https://picsum.photos/seed/meta-ad-demo-1/600/600",
      videoUrl: null,
      snapshotUrl: null,
      platforms: ["facebook", "instagram"],
      isActive: true,
      deliveryStart: now,
      deliveryStop: null,
      scrapedAt: now,
      rawData: { _demo: true },
    },
    {
      externalId: `demo-ad-${term}-2`,
      pageId: "demo-page-2",
      pageName: `Rival ${term}`,
      pageProfileUrl: null,
      bodyText: `Before & after dalam 7 hari. Buktikan sendiri manfaat ${term}.`,
      linkTitle: "Uji Coba Gratis",
      linkUrl: "https://example.com/trial",
      ctaType: "LEARN_MORE",
      ctaText: "Pelajari lebih lanjut",
      mediaType: "VIDEO",
      imageUrl: "https://picsum.photos/seed/meta-ad-demo-video/600/800",
      videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      snapshotUrl: null,
      platforms: ["facebook"],
      isActive: true,
      deliveryStart: now,
      deliveryStop: null,
      scrapedAt: now,
      rawData: { _demo: true },
    },
  ];
}

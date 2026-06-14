import "server-only";

import {
  fetchApifyDataset,
  isApifyConfigured,
  startApifyActor,
  waitForApifyRun,
} from "@/lib/apify/client";

export type TikTokTrendSignal = {
  term: string;
  source: string;
  views?: number;
};

/** Input schema clockworks/tiktok-scraper — tanpa download media untuk hemat biaya. */
export function buildClockworksTikTokInput(
  hashtags: string[],
): Record<string, unknown> {
  return {
    hashtags: hashtags.map((h) => h.replace(/^#/, "")),
    resultsPerPage: 20,
    proxyCountryCode: "ID",
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
    shouldDownloadAvatars: false,
    shouldDownloadMusicCovers: false,
    excludePinnedPosts: false,
  };
}

function playCountOf(item: Record<string, unknown>): number {
  if (typeof item.playCount === "number") return item.playCount;
  if (typeof item.views === "number") return item.views;
  const meta = item.videoMeta as Record<string, unknown> | undefined;
  if (meta && typeof meta.playCount === "number") return meta.playCount;
  return 0;
}

function extractHashtagsFromText(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return matches.map((h) => h.slice(1).toLowerCase());
}

function seedTagFromItem(item: Record<string, unknown>): string | null {
  const candidates = [
    item.input,
    item.searchQuery,
    item.hashtag,
    item.challengeTitle,
    item.challengeName,
    item.name,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return c.trim().replace(/^#/, "").toLowerCase();
    }
  }
  return null;
}

/** Parse dataset clockworks → sinyal tren (hashtag + agregat views). */
export function parseTikTokScraperItems(
  items: Record<string, unknown>[],
  seedHashtags: string[],
): TikTokTrendSignal[] {
  const viewByTerm = new Map<string, number>();
  const seedSet = new Set(seedHashtags.map((h) => h.toLowerCase()));

  for (const item of items) {
    const views = playCountOf(item);
    const text = typeof item.text === "string" ? item.text : "";
    const tags = new Set<string>();

    const seed = seedTagFromItem(item);
    if (seed) tags.add(seed);

    for (const h of extractHashtagsFromText(text)) {
      tags.add(h);
    }

    if (tags.size === 0 && text.trim()) {
      tags.add(text.slice(0, 80).toLowerCase());
    }

    for (const tag of tags) {
      if (tag.length < 2) continue;
      viewByTerm.set(tag, (viewByTerm.get(tag) ?? 0) + views);
    }
  }

  for (const seed of seedSet) {
    if (!viewByTerm.has(seed)) {
      viewByTerm.set(seed, 0);
    }
  }

  return [...viewByTerm.entries()]
    .map(([term, views]) => ({
      term,
      source: seedSet.has(term) ? "tiktok_hashtag" : "tiktok_caption",
      views: views > 0 ? views : undefined,
    }))
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 50);
}

export function isTikTokTrendsConfigured(): boolean {
  return (
    isApifyConfigured() && !!process.env.APIFY_ACTOR_TIKTOK_TRENDS?.trim()
  );
}

export async function fetchTikTokTrendSignals(
  hashtags: string[],
): Promise<TikTokTrendSignal[]> {
  const actorId = process.env.APIFY_ACTOR_TIKTOK_TRENDS?.trim();
  if (!actorId) return [];

  const normalized = [
    ...new Set(
      hashtags.map((h) => h.trim().replace(/^#/, "")).filter(Boolean),
    ),
  ];
  if (normalized.length === 0) return [];

  try {
    const { runId } = await startApifyActor(
      actorId,
      buildClockworksTikTokInput(normalized),
    );

    const { status, datasetId } = await waitForApifyRun(runId, {
      maxWaitMs: 300_000,
      pollIntervalMs: 5_000,
    });

    if (status !== "SUCCEEDED") {
      console.warn("[trend-radar/tiktok] run gagal:", status);
      return [];
    }

    const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
    return parseTikTokScraperItems(items, normalized);
  } catch (err) {
    console.warn("[trend-radar/tiktok] gagal", err);
    return [];
  }
}

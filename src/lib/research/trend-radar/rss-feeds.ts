import "server-only";

import Parser from "rss-parser";

export type RssTrendSignal = {
  term: string;
  source: string;
  title: string;
  link?: string;
};

/**
 * Kurasi feed RSS untuk Trend Radar (industri + konsumen).
 * Override via env TREND_RSS_FEEDS (comma-separated).
 */
export const RECOMMENDED_RSS_FEEDS = [
  /** WWD Beauty — berita industri: brand, launch, regulasi US */
  "https://wwd.com/beauty-industry-news/feed/",
  /** Global Cosmetics News — B2B global: manufaktur, packaging, teknologi */
  "https://www.globalcosmeticsnews.com/feed/",
  /** Premium Beauty News — Eropa: regulasi, bahan, sustainability */
  "https://www.premiumbeautynews.com/spip.php?page=backend",
  /** Allure — tren konsumen & produk yang ramai dibahas */
  "https://www.allure.com/feed/rss",
  /** NutraIngredients — bahan aktif, nutricosmetics, riset ingredient */
  "https://www.nutraingredients.com/arc/outboundfeeds/rss/",
] as const;

const DEFAULT_FEEDS = [...RECOMMENDED_RSS_FEEDS];

function getFeedUrls(): string[] {
  const env = process.env.TREND_RSS_FEEDS?.trim();
  if (env) {
    return env.split(",").map((u) => u.trim()).filter(Boolean);
  }
  return DEFAULT_FEEDS;
}

const parser = new Parser({ timeout: 10000 });

export async function fetchRssTrendSignals(): Promise<RssTrendSignal[]> {
  const feeds = getFeedUrls();
  const signals: RssTrendSignal[] = [];

  await Promise.allSettled(
    feeds.map(async (feedUrl) => {
      try {
        const feed = await parser.parseURL(feedUrl);
        for (const item of (feed.items ?? []).slice(0, 15)) {
          const title = item.title?.trim();
          if (!title) continue;
          signals.push({
            term: title,
            source: `rss:${feed.title ?? feedUrl}`,
            title,
            link: item.link,
          });
        }
      } catch (err) {
        console.warn("[trend-radar/rss] gagal parse", feedUrl, err);
      }
    }),
  );

  return signals;
}

import "server-only";

import Parser from "rss-parser";

export type RssTrendSignal = {
  term: string;
  source: string;
  title: string;
  link?: string;
};

export type TrendRssFeedEntry = {
  url: string;
  label?: string;
  enabled: boolean;
};

/** Kurasi feed RSS — label untuk UI. */
export const RECOMMENDED_RSS_FEED_META: { url: string; label: string }[] = [
  { url: "https://wwd.com/beauty-industry-news/feed/", label: "WWD Beauty" },
  {
    url: "https://www.globalcosmeticsnews.com/feed/",
    label: "Global Cosmetics News",
  },
  {
    url: "https://www.premiumbeautynews.com/spip.php?page=backend",
    label: "Premium Beauty News",
  },
  { url: "https://www.allure.com/feed/rss", label: "Allure" },
  {
    url: "https://www.nutraingredients.com/arc/outboundfeeds/rss/",
    label: "NutraIngredients",
  },
];

export const RECOMMENDED_RSS_FEEDS = RECOMMENDED_RSS_FEED_META.map(
  (m) => m.url,
) as readonly string[];

function labelFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return url.slice(0, 40);
  }
}

export function getDefaultRssFeedEntries(): TrendRssFeedEntry[] {
  const env = process.env.TREND_RSS_FEEDS?.trim();
  const urls = env
    ? env
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean)
    : [...RECOMMENDED_RSS_FEEDS];

  const metaByUrl = new Map(
    RECOMMENDED_RSS_FEED_META.map((m) => [m.url, m.label]),
  );

  return urls.map((url) => ({
    url,
    label: metaByUrl.get(url) ?? labelFromUrl(url),
    enabled: true,
  }));
}

const parser = new Parser({ timeout: 10000 });

export async function fetchRssTrendSignals(
  feedUrls: string[],
): Promise<RssTrendSignal[]> {
  if (feedUrls.length === 0) return [];

  const signals: RssTrendSignal[] = [];

  await Promise.allSettled(
    feedUrls.map(async (feedUrl) => {
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

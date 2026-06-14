export type TrendRssFeedEntry = {
  url: string;
  label?: string;
  enabled: boolean;
};

export type TrendSourceEnabled = {
  googleTrends: boolean;
  rss: boolean;
  tiktok: boolean;
  bpom: boolean;
};

export type TrendSourceConfig = {
  enabled: TrendSourceEnabled;
  rssFeeds: TrendRssFeedEntry[];
  tiktokHashtags: string[];
};

export function normalizeHashtags(raw: string[]): string[] {
  return [...new Set(raw.map((h) => h.trim().replace(/^#/, "")).filter(Boolean))];
}

export function parseHashtagInput(input: string): string[] {
  return normalizeHashtags(
    input
      .split(/[,;\n]+/)
      .map((h) => h.trim())
      .filter(Boolean),
  );
}

export function hashtagsToInput(hashtags: string[]): string {
  return hashtags.join(", ");
}

export function enabledRssFeedUrls(config: TrendSourceConfig): string[] {
  return config.rssFeeds.filter((f) => f.enabled).map((f) => f.url);
}

export function summarizeEnabledSources(config: TrendSourceConfig): string[] {
  const labels: string[] = [];
  if (config.enabled.googleTrends) labels.push("Google Trends");
  if (config.enabled.rss) labels.push("RSS");
  if (config.enabled.tiktok) labels.push("TikTok");
  if (config.enabled.bpom) labels.push("BPOM");
  return labels;
}

export function labelFromRssUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

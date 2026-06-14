import "server-only";

import { fetchBeautyTrendSignals } from "@/lib/research/trend-radar/google-trends";
import { fetchRssTrendSignals } from "@/lib/research/trend-radar/rss-feeds";
import { fetchTikTokTrendSignals } from "@/lib/research/trend-radar/tiktok-trends";
import { fetchBpomTrendSignals } from "@/lib/research/trend-radar/bpom-scraper";
import { enabledRssFeedUrls } from "@/lib/research/trend-radar/trend-source-config-types";
import {
  getDefaultTrendSourceConfig,
  type TrendSourceConfig,
} from "@/lib/research/trend-radar/trend-source-config";

export type CollectedTrendRaw = {
  signals: {
    term: string;
    source: string;
    meta?: Record<string, unknown>;
  }[];
};

const DEFAULT_SEEDS = [
  "skincare indonesia",
  "bodycare",
  "sunscreen",
  "serum brightening",
  "kosmetik lokal",
];

export async function collectTrendSources(
  seedKeywords: string[] = [],
  sourceConfig: TrendSourceConfig = getDefaultTrendSourceConfig(),
): Promise<CollectedTrendRaw> {
  const seeds =
    seedKeywords.length > 0 ? seedKeywords : DEFAULT_SEEDS;

  const tasks: Promise<
    {
      term: string;
      source: string;
      meta?: Record<string, unknown>;
    }[]
  >[] = [];

  if (sourceConfig.enabled.googleTrends) {
    tasks.push(
      fetchBeautyTrendSignals(seeds).then((rows) =>
        rows.map((g) => ({
          term: g.term,
          source: g.source,
          meta: { value: g.value, rising: g.rising },
        })),
      ),
    );
  }

  if (sourceConfig.enabled.rss) {
    const feedUrls = enabledRssFeedUrls(sourceConfig);
    tasks.push(
      fetchRssTrendSignals(feedUrls).then((rows) =>
        rows.map((r) => ({
          term: r.term,
          source: r.source,
          meta: { title: r.title, link: r.link },
        })),
      ),
    );
  }

  if (sourceConfig.enabled.tiktok) {
    tasks.push(
      fetchTikTokTrendSignals(sourceConfig.tiktokHashtags).then((rows) =>
        rows.map((t) => ({
          term: t.term,
          source: t.source,
          meta: { views: t.views },
        })),
      ),
    );
  }

  if (sourceConfig.enabled.bpom) {
    tasks.push(
      fetchBpomTrendSignals(seeds).then((rows) =>
        rows.map((b) => ({
          term: b.term,
          source: b.source,
          meta: {
            productName: b.productName,
            registrationNo: b.registrationNo,
            brandName: b.brandName,
          },
        })),
      ),
    );
  }

  const batches = await Promise.all(tasks);
  return { signals: batches.flat() };
}

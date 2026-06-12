import "server-only";

import { fetchBeautyTrendSignals } from "@/lib/research/trend-radar/google-trends";
import { fetchRssTrendSignals } from "@/lib/research/trend-radar/rss-feeds";
import { fetchTikTokTrendSignals } from "@/lib/research/trend-radar/tiktok-trends";
import { fetchBpomTrendSignals } from "@/lib/research/trend-radar/bpom-scraper";

export type CollectedTrendRaw = {
  signals: {
    term: string;
    source: string;
    meta?: Record<string, unknown>;
  }[];
};

export async function collectTrendSources(
  seedKeywords: string[] = [],
): Promise<CollectedTrendRaw> {
  const seeds =
    seedKeywords.length > 0
      ? seedKeywords
      : [
          "skincare indonesia",
          "bodycare",
          "sunscreen",
          "serum brightening",
          "kosmetik lokal",
        ];

  const [google, rss, tiktok, bpom] = await Promise.all([
    fetchBeautyTrendSignals(seeds),
    fetchRssTrendSignals(),
    fetchTikTokTrendSignals(),
    fetchBpomTrendSignals(),
  ]);

  const signals = [
    ...google.map((g) => ({
      term: g.term,
      source: g.source,
      meta: { value: g.value, rising: g.rising },
    })),
    ...rss.map((r) => ({
      term: r.term,
      source: r.source,
      meta: { title: r.title, link: r.link },
    })),
    ...tiktok.map((t) => ({
      term: t.term,
      source: t.source,
      meta: { views: t.views },
    })),
    ...bpom.map((b) => ({
      term: b.term,
      source: b.source,
      meta: { productName: b.productName },
    })),
  ];

  return { signals };
}

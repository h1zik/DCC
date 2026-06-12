import "server-only";

import {
  fetchRelatedQueriesPayload,
  forEachTrendsKeywordSequential,
} from "@/lib/research/google-trends-client";

export type TrendSignal = {
  term: string;
  source: string;
  value?: number;
  rising?: boolean;
};

const DEFAULT_SEEDS = [
  "skincare indonesia",
  "serum wajah",
  "sunscreen",
  "body lotion",
  "brightening serum",
  "ceramide",
  "niacinamide",
  "exosome skincare",
];

function parseSeedToSignals(seed: string, parsed: NonNullable<Awaited<ReturnType<typeof fetchRelatedQueriesPayload>>>): TrendSignal[] {
  const signals: TrendSignal[] = [];
  const lists = parsed.default?.rankedList ?? [];
  lists.forEach((list, idx) => {
    const rising = idx === 1;
    for (const item of list.rankedKeyword ?? []) {
      if (item.query) {
        signals.push({
          term: item.query,
          source: `google_trends:${seed}`,
          value: item.value,
          rising,
        });
      }
    }
  });
  return signals;
}

export async function fetchBeautyTrendSignals(
  seeds: string[] = DEFAULT_SEEDS,
): Promise<TrendSignal[]> {
  const uniqueSeeds = [...new Set(seeds)].slice(0, 6);
  const signals: TrendSignal[] = [];

  await forEachTrendsKeywordSequential(uniqueSeeds, async (seed) => {
    try {
      const parsed = await fetchRelatedQueriesPayload(seed);
      if (parsed) {
        signals.push(...parseSeedToSignals(seed, parsed));
      }
    } catch (err) {
      console.warn("[trend-radar/google-trends] gagal", seed, err);
    }
    return seed;
  });

  return signals;
}

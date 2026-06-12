import "server-only";

import {
  fetchInterestOverTimePayload,
  fetchRelatedQueriesPayload,
} from "@/lib/research/google-trends-client";

export type TrendsRelatedKeyword = {
  keyword: string;
  value: number;
  type: "top" | "rising";
};

export async function fetchRelatedKeywords(
  seed: string,
): Promise<TrendsRelatedKeyword[]> {
  try {
    const parsed = await fetchRelatedQueriesPayload(seed);
    if (!parsed) return [];

    const lists = parsed.default?.rankedList ?? [];
    const results: TrendsRelatedKeyword[] = [];

    lists.forEach((list, listIdx) => {
      const type = listIdx === 0 ? "top" : "rising";
      for (const item of list.rankedKeyword ?? []) {
        if (item.query) {
          results.push({
            keyword: item.query,
            value: item.value ?? 0,
            type: type as "top" | "rising",
          });
        }
      }
    });

    return results;
  } catch (err) {
    console.warn("[google-trends-keywords] relatedQueries gagal", err);
    return [];
  }
}

export async function fetchInterestTrend(
  keyword: string,
): Promise<"up" | "down" | "stable"> {
  try {
    const startTime = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const parsed = await fetchInterestOverTimePayload(keyword, startTime);
    if (!parsed) return "stable";

    const values =
      parsed.default?.timelineData?.[0]?.value?.filter((v) => v > 0) ?? [];
    if (values.length < 4) return "stable";

    const mid = Math.floor(values.length / 2);
    const firstHalf =
      values.slice(0, mid).reduce((a, b) => a + b, 0) / Math.max(mid, 1);
    const secondHalf =
      values.slice(mid).reduce((a, b) => a + b, 0) /
      Math.max(values.length - mid, 1);

    if (secondHalf > firstHalf * 1.15) return "up";
    if (secondHalf < firstHalf * 0.85) return "down";
    return "stable";
  } catch {
    return "stable";
  }
}

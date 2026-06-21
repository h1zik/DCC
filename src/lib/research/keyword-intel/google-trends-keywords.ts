import "server-only";

import {
  fetchInterestOverTimePayload,
  fetchRelatedQueriesPayload,
  isGoogleTrendsCircuitOpen,
  trendsSleep,
} from "@/lib/research/google-trends-client";
import { inferTrendFromTimelinePoints } from "@/lib/research/keyword-intel/keyword-trend";

const REQUEST_GAP_MS = 2800;

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
): Promise<"up" | "down" | "stable" | null> {
  if (isGoogleTrendsCircuitOpen()) return null;

  try {
    const startTime = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const parsed = await fetchInterestOverTimePayload(keyword, startTime);
    if (!parsed) return null;
    return inferTrendFromTimelinePoints(parsed.default?.timelineData);
  } catch {
    return null;
  }
}

export async function fetchInterestTrendsForKeywords(
  keywords: string[],
): Promise<Map<string, "up" | "down" | "stable">> {
  if (isGoogleTrendsCircuitOpen()) return new Map();

  const unique = [
    ...new Set(keywords.map((k) => k.trim()).filter(Boolean)),
  ].slice(0, 12);

  const map = new Map<string, "up" | "down" | "stable">();
  for (let i = 0; i < unique.length; i++) {
    if (isGoogleTrendsCircuitOpen()) break;
    if (i > 0) await trendsSleep(REQUEST_GAP_MS);
    const keyword = unique[i]!;
    const trend = await fetchInterestTrend(keyword);
    if (trend) map.set(keyword.toLowerCase(), trend);
  }
  return map;
}

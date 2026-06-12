import "server-only";

import { ReviewSentiment } from "@prisma/client";

export type ThemeCount = { theme: string; count: number };
export type KeywordCount = { word: string; count: number };
export type TimelineBucket = {
  month: string;
  positive: number;
  neutral: number;
  negative: number;
};

type AnalysisRow = {
  sentiment: ReviewSentiment;
  complaintThemes: string[];
  praiseThemes: string[];
  keywords: string[];
  reviewDate: Date | null;
};

function countThemes(items: string[]): ThemeCount[] {
  const map = new Map<string, number>();
  for (const raw of items) {
    const theme = raw.trim().toLowerCase();
    if (!theme) continue;
    map.set(theme, (map.get(theme) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function countKeywords(items: string[]): KeywordCount[] {
  const map = new Map<string, number>();
  for (const raw of items) {
    const word = raw.trim().toLowerCase();
    if (!word || word.length < 2) continue;
    map.set(word, (map.get(word) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function aggregateReviewAnalyses(rows: AnalysisRow[]) {
  const total = rows.length || 1;
  let positive = 0;
  let neutral = 0;
  let negative = 0;

  const allComplaints: string[] = [];
  const allPraises: string[] = [];
  const allKeywords: string[] = [];
  const timelineMap = new Map<string, { positive: number; neutral: number; negative: number }>();

  for (const row of rows) {
    if (row.sentiment === ReviewSentiment.POSITIVE) positive += 1;
    else if (row.sentiment === ReviewSentiment.NEUTRAL) neutral += 1;
    else negative += 1;

    allComplaints.push(...row.complaintThemes);
    allPraises.push(...row.praiseThemes);
    allKeywords.push(...row.keywords);

    const date = row.reviewDate ?? new Date();
    const key = monthKey(date);
    const bucket = timelineMap.get(key) ?? {
      positive: 0,
      neutral: 0,
      negative: 0,
    };
    if (row.sentiment === ReviewSentiment.POSITIVE) bucket.positive += 1;
    else if (row.sentiment === ReviewSentiment.NEUTRAL) bucket.neutral += 1;
    else bucket.negative += 1;
    timelineMap.set(key, bucket);
  }

  const timelineBuckets: TimelineBucket[] = [...timelineMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({ month, ...counts }));

  return {
    positivePct: (positive / total) * 100,
    neutralPct: (neutral / total) * 100,
    negativePct: (negative / total) * 100,
    topComplaints: countThemes(allComplaints),
    topPraises: countThemes(allPraises),
    keywordCloud: countKeywords(allKeywords),
    timelineBuckets,
  };
}

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

export type DemographicHints = {
  ageBand?: string | null;
  skinType?: string | null;
  gender?: string | null;
};

export type SeverityByTheme = {
  theme: string;
  avgSeverity: number;
  count: number;
};

export type ReviewDemographics = {
  skinTypes: { value: string; count: number }[];
  ageBands: { value: string; count: number }[];
  genders: { value: string; count: number }[];
};

type AnalysisRow = {
  sentiment: ReviewSentiment;
  complaintThemes: string[];
  praiseThemes: string[];
  keywords: string[];
  reviewDate: Date | null;
  complaintSeverity?: number | null;
  demographicHints?: DemographicHints | null;
};

function countValues(items: (string | null | undefined)[]) {
  const map = new Map<string, number>();
  for (const raw of items) {
    const value = raw?.trim().toLowerCase();
    if (!value) continue;
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

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
  const severityMap = new Map<string, { total: number; count: number }>();
  const skinTypes: (string | null | undefined)[] = [];
  const ageBands: (string | null | undefined)[] = [];
  const genders: (string | null | undefined)[] = [];

  for (const row of rows) {
    if (row.sentiment === ReviewSentiment.POSITIVE) positive += 1;
    else if (row.sentiment === ReviewSentiment.NEUTRAL) neutral += 1;
    else negative += 1;

    allComplaints.push(...row.complaintThemes);
    allPraises.push(...row.praiseThemes);
    allKeywords.push(...row.keywords);

    if (typeof row.complaintSeverity === "number" && row.complaintSeverity > 0) {
      for (const theme of row.complaintThemes) {
        const key = theme.trim().toLowerCase();
        if (!key) continue;
        const cur = severityMap.get(key) ?? { total: 0, count: 0 };
        cur.total += row.complaintSeverity;
        cur.count += 1;
        severityMap.set(key, cur);
      }
    }

    if (row.demographicHints) {
      skinTypes.push(row.demographicHints.skinType);
      ageBands.push(row.demographicHints.ageBand);
      genders.push(row.demographicHints.gender);
    }

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

  const severityByTheme: SeverityByTheme[] = [...severityMap.entries()]
    .map(([theme, { total, count }]) => ({
      theme,
      avgSeverity: total / count,
      count,
    }))
    .sort((a, b) => b.avgSeverity * b.count - a.avgSeverity * a.count)
    .slice(0, 10);

  const demographics: ReviewDemographics = {
    skinTypes: countValues(skinTypes),
    ageBands: countValues(ageBands),
    genders: countValues(genders),
  };

  return {
    positivePct: (positive / total) * 100,
    neutralPct: (neutral / total) * 100,
    negativePct: (negative / total) * 100,
    topComplaints: countThemes(allComplaints),
    topPraises: countThemes(allPraises),
    keywordCloud: countKeywords(allKeywords),
    timelineBuckets,
    severityByTheme,
    demographics,
  };
}

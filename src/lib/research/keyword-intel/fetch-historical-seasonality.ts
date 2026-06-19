import "server-only";

import { fetchInterestOverTimePayload } from "@/lib/research/google-trends-client";
import type { SeasonalCurve } from "@/lib/research/keyword-intel/keyword-signal-types";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

function monthLabelFromDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Jan";
  return MONTH_LABELS[d.getMonth()] ?? "Jan";
}

export async function fetchSeasonalCurvesFromGoogleTrends(
  keywords: string[],
): Promise<SeasonalCurve[]> {
  const curves: SeasonalCurve[] = [];
  const top = keywords.slice(0, 8);

  for (const keyword of top) {
    try {
      const startTime = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const parsed = await fetchInterestOverTimePayload(keyword, startTime);
      if (!parsed?.default?.timelineData?.length) continue;

      const buckets = new Map<string, number[]>();
      for (const point of parsed.default.timelineData) {
        const label = monthLabelFromDate(String(point.formattedTime ?? point.time ?? ""));
        const val = point.value?.[0] ?? 0;
        if (!buckets.has(label)) buckets.set(label, []);
        buckets.get(label)!.push(val);
      }

      const months = MONTH_LABELS.map((month) => {
        const vals = buckets.get(month) ?? [];
        const index =
          vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        return { month, index: Math.round(index) };
      });

      curves.push({
        keyword,
        source: "google_trends",
        months,
      });
    } catch (err) {
      console.warn("[fetch-historical-seasonality] Trends gagal", keyword, err);
    }
  }

  return curves;
}

export async function fetchHistoricalSeasonality(
  keywords: string[],
): Promise<SeasonalCurve[]> {
  return fetchSeasonalCurvesFromGoogleTrends(keywords);
}

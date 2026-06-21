import type { SeasonalCurve } from "@/lib/research/keyword-intel/keyword-signal-types";

export type KeywordTrendDirection = "up" | "down" | "stable";

const TREND_RANK: Record<KeywordTrendDirection, number> = {
  up: 3,
  down: 2,
  stable: 1,
};

/** Gabungkan arah tren — utamakan up/down di atas stable. */
export function mergeKeywordTrend(
  existing: KeywordTrendDirection | null | undefined,
  incoming: KeywordTrendDirection | null | undefined,
): KeywordTrendDirection | null | undefined {
  if (!incoming) return existing ?? null;
  if (!existing) return incoming;
  return TREND_RANK[incoming] >= TREND_RANK[existing] ? incoming : existing;
}

export function inferTrendFromTimelineValues(
  values: number[],
): KeywordTrendDirection {
  const filtered = values.filter((v) => Number.isFinite(v) && v > 0);
  if (filtered.length < 4) return "stable";

  const mid = Math.floor(filtered.length / 2);
  const firstHalf =
    filtered.slice(0, mid).reduce((a, b) => a + b, 0) / Math.max(mid, 1);
  const secondHalf =
    filtered.slice(mid).reduce((a, b) => a + b, 0) /
    Math.max(filtered.length - mid, 1);

  if (secondHalf > firstHalf * 1.15) return "up";
  if (secondHalf < firstHalf * 0.85) return "down";
  return "stable";
}

export function inferTrendFromTimelinePoints(
  timelineData: { value?: number[] }[] | undefined,
): KeywordTrendDirection {
  const values =
    timelineData?.flatMap((point) => point.value ?? []).filter((v) => v > 0) ??
    [];
  return inferTrendFromTimelineValues(values);
}

export function trendFromSeasonalCurve(
  curve: SeasonalCurve,
): KeywordTrendDirection {
  const values = curve.months
    .map((m) => m.index ?? m.volume ?? 0)
    .filter((v) => v > 0);
  return inferTrendFromTimelineValues(values);
}

/** Fallback saat Google Trends diblokir — perkiraan dari rank Shopee autocomplete. */
export function inferTrendFromAutocompleteMeta(
  meta?: Record<string, unknown> | null,
): KeywordTrendDirection | null {
  const rank = Number(meta?.rank);
  if (!Number.isFinite(rank) || rank <= 0) return null;
  if (rank <= 5) return "up";
  if (rank >= 16) return "down";
  return "stable";
}

"use client";

import type { TrendSignalStats } from "@/lib/research/trend-radar/trend-signal-types";

export function TrendSignalStatsLine({
  stats,
}: {
  stats: TrendSignalStats | null;
}) {
  if (!stats) return null;

  const parts = [
    stats.external.googleTrends > 0
      ? `Google ${stats.external.googleTrends}`
      : null,
    stats.external.rss > 0 ? `RSS ${stats.external.rss}` : null,
    stats.external.tiktok > 0 ? `TikTok ${stats.external.tiktok}` : null,
    stats.external.bpom > 0 ? `BPOM ${stats.external.bpom}` : null,
    stats.internal.reviewIntel > 0
      ? `Review ${stats.internal.reviewIntel}`
      : null,
    stats.internal.competitor > 0
      ? `Competitor ${stats.internal.competitor}`
      : null,
    stats.internal.keywordIntel > 0
      ? `Keyword ${stats.internal.keywordIntel}`
      : null,
    stats.internal.socialListening > 0
      ? `Social ${stats.internal.socialListening}`
      : null,
  ].filter(Boolean);

  return (
    <p className="text-muted-foreground text-xs">
      {stats.total} sinyal
      {parts.length > 0 ? ` (${parts.join(" · ")})` : ""}
    </p>
  );
}

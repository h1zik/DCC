"use client";

import type { KeywordSignalStats } from "@/lib/research/keyword-intel/keyword-signal-types";

export function KeywordSignalStatsLine({
  stats,
}: {
  stats: KeywordSignalStats | null;
}) {
  if (!stats) return null;

  const parts: string[] = [`${stats.total} sinyal`];
  const ext = stats.external;
  if (ext.shopee > 0) parts.push(`${ext.shopee} Shopee`);
  if (ext.tokopedia > 0) parts.push(`${ext.tokopedia} Tokopedia`);
  if (ext.googleTrends > 0) parts.push(`${ext.googleTrends} Trends`);
  if (ext.dataforseo > 0) parts.push(`${ext.dataforseo} Google vol`);
  if (ext.shopeeSearch > 0) parts.push(`${ext.shopeeSearch} Shopee sample`);
  const int = stats.internal;
  if (int.competitor > 0) parts.push(`${int.competitor} Competitor`);
  if (int.reviewIntel > 0) parts.push(`${int.reviewIntel} Review`);
  if (int.socialListening > 0) parts.push(`${int.socialListening} Social`);

  return (
    <p className="text-muted-foreground mt-1 text-xs">{parts.join(" · ")}</p>
  );
}

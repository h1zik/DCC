"use client";

import type { KeywordSignalStats } from "@/lib/research/keyword-intel/keyword-signal-types";
import { ResearchHubStatChip } from "@/components/research-hub/research-hub-primitives";

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

export function KeywordSignalStatsChips({
  stats,
}: {
  stats: KeywordSignalStats | null;
}) {
  if (!stats) return null;

  const chips: { label: string; value: number }[] = [];
  const ext = stats.external;
  if (ext.shopee > 0) chips.push({ label: "Shopee", value: ext.shopee });
  if (ext.tokopedia > 0) chips.push({ label: "Tokopedia", value: ext.tokopedia });
  if (ext.googleTrends > 0) chips.push({ label: "Trends", value: ext.googleTrends });
  if (ext.dataforseo > 0) chips.push({ label: "Google vol", value: ext.dataforseo });
  if (ext.shopeeSearch > 0) chips.push({ label: "Shopee sample", value: ext.shopeeSearch });
  const int = stats.internal;
  if (int.competitor > 0) chips.push({ label: "Competitor", value: int.competitor });
  if (int.reviewIntel > 0) chips.push({ label: "Review", value: int.reviewIntel });
  if (int.socialListening > 0) chips.push({ label: "Social", value: int.socialListening });

  return (
    <div className="flex flex-wrap gap-2">
      <ResearchHubStatChip
        label="Total sinyal"
        value={stats.total.toLocaleString("id-ID")}
        tone="primary"
      />
      {chips.map((chip) => (
        <ResearchHubStatChip
          key={chip.label}
          label={chip.label}
          value={chip.value.toLocaleString("id-ID")}
        />
      ))}
    </div>
  );
}

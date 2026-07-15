"use client";

import type { TrendSignalStats } from "@/lib/research/trend-radar/trend-signal-types";
import { cn } from "@/lib/utils";

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

/** Chip mini per keluarga sumber sinyal — tile mini gaya bento. */
function SignalStatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex min-w-[6.25rem] flex-col gap-0.5 rounded-2xl px-3.5 py-2.5",
        accent
          ? "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)]"
          : "bg-muted/60",
      )}
    >
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wide",
          accent
            ? "text-[var(--lab-accent,var(--primary))]"
            : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-lg font-extrabold tabular-nums tracking-tight",
          accent && "text-[var(--lab-accent,var(--primary))]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function TrendSignalStatsChips({
  stats,
}: {
  stats: TrendSignalStats | null;
}) {
  if (!stats) return null;

  const chips: { label: string; value: number }[] = [];
  if (stats.external.googleTrends > 0) {
    chips.push({ label: "Google", value: stats.external.googleTrends });
  }
  if (stats.external.rss > 0) {
    chips.push({ label: "RSS", value: stats.external.rss });
  }
  if (stats.external.tiktok > 0) {
    chips.push({ label: "TikTok", value: stats.external.tiktok });
  }
  if (stats.external.bpom > 0) {
    chips.push({ label: "BPOM", value: stats.external.bpom });
  }
  if (stats.internal.reviewIntel > 0) {
    chips.push({ label: "Review", value: stats.internal.reviewIntel });
  }
  if (stats.internal.competitor > 0) {
    chips.push({ label: "Competitor", value: stats.internal.competitor });
  }
  if (stats.internal.keywordIntel > 0) {
    chips.push({ label: "Keyword", value: stats.internal.keywordIntel });
  }
  if (stats.internal.socialListening > 0) {
    chips.push({ label: "Social", value: stats.internal.socialListening });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <SignalStatTile
        label="Total sinyal"
        value={stats.total.toLocaleString("id-ID")}
        accent
      />
      {chips.map((chip) => (
        <SignalStatTile
          key={chip.label}
          label={chip.label}
          value={chip.value.toLocaleString("id-ID")}
        />
      ))}
    </div>
  );
}

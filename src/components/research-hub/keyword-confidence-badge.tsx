"use client";

import { cn } from "@/lib/utils";

export function KeywordConfidenceBadge({
  confidence,
  koiScore,
}: {
  confidence: string;
  koiScore?: number | null;
}) {
  const tone =
    confidence === "HIGH"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : confidence === "MED"
        ? "bg-sky-500/15 text-sky-800 dark:text-sky-200"
        : "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
        tone,
      )}
    >
      {confidence}
      {typeof koiScore === "number"
        ? ` · KOI ${Math.round(koiScore * 100)}`
        : ""}
    </span>
  );
}

"use client";

import type { TrendConfidence } from "@prisma/client";
import { cn } from "@/lib/utils";

const CONFIDENCE_STYLES: Record<TrendConfidence, string> = {
  HIGH: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  MED: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  LOW: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

const CONFIDENCE_LABELS: Record<TrendConfidence, string> = {
  HIGH: "Confidence tinggi",
  MED: "Confidence sedang",
  LOW: "Confidence rendah",
};

export function TrendConfidenceBadge({
  confidence,
  tmiScore,
  className,
}: {
  confidence: TrendConfidence | string;
  tmiScore?: number | null;
  className?: string;
}) {
  const key = (confidence as TrendConfidence) in CONFIDENCE_LABELS
    ? (confidence as TrendConfidence)
    : "MED";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        CONFIDENCE_STYLES[key],
        className,
      )}
    >
      {CONFIDENCE_LABELS[key]}
      {typeof tmiScore === "number" ? (
        <span className="tabular-nums">· TMI {Math.round(tmiScore * 100)}</span>
      ) : null}
    </span>
  );
}

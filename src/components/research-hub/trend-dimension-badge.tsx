"use client";

import { TrendDimension } from "@prisma/client";
import { TREND_DIMENSION_LABELS } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

export function TrendDimensionBadge({
  dimension,
  className,
}: {
  dimension: TrendDimension;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-muted/70 text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {TREND_DIMENSION_LABELS[dimension]}
    </span>
  );
}

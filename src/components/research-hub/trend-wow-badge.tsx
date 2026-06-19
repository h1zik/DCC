"use client";

import type { TrendWowStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const WOW_LABELS: Record<TrendWowStatus, string> = {
  NEW: "Baru",
  ACCELERATING: "Mempercepat",
  STABLE: "Stabil",
  FADING: "Memudar",
  GONE: "Hilang",
};

const WOW_STYLES: Record<TrendWowStatus, string> = {
  NEW: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  ACCELERATING: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  STABLE: "bg-muted text-muted-foreground",
  FADING: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  GONE: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export function TrendWowBadge({
  status,
  className,
}: {
  status: TrendWowStatus | string | null | undefined;
  className?: string;
}) {
  if (!status || !(status in WOW_LABELS)) return null;
  const key = status as TrendWowStatus;

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
        WOW_STYLES[key],
        className,
      )}
    >
      WoW: {WOW_LABELS[key]}
    </span>
  );
}

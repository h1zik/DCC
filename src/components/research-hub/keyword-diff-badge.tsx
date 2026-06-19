"use client";

import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  NEW: "Baru",
  RISING: "Naik",
  STABLE: "Stabil",
  FADING: "Turun",
};

export function KeywordDiffBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;

  const tone =
    status === "NEW" || status === "RISING"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "FADING"
        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
        : "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        tone,
      )}
    >
      {LABELS[status] ?? status}
    </span>
  );
}

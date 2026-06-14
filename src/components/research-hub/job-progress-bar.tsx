"use client";

import { Loader2 } from "lucide-react";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * Labeled multi-step progress for long-running research jobs (scraping, AI
 * analysis). Replaces ambiguous "in progress" spinners with a real progress
 * bar + current step label.
 */
export function JobProgressBar({
  percent,
  stepLabel,
  className,
  title = "Memproses",
}: {
  percent: number;
  stepLabel?: string | null;
  className?: string;
  title?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-300/60 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/10",
        className,
      )}
    >
      <Progress value={clamped}>
        <ProgressLabel className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {title}
        </ProgressLabel>
        <ProgressValue className="text-amber-900/80 dark:text-amber-200/80" />
      </Progress>
      {stepLabel ? (
        <p className="mt-2 text-xs text-amber-900/70 dark:text-amber-200/70">
          {stepLabel}
        </p>
      ) : null}
    </div>
  );
}

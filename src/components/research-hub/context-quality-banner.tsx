"use client";

import { cn } from "@/lib/utils";

export function ContextQualityBanner({
  notice,
  warnings = [],
  coveragePct,
  className,
}: {
  notice: string | null;
  warnings?: string[];
  coveragePct?: number;
  className?: string;
}) {
  if (!notice && warnings.length === 0 && coveragePct == null) return null;

  const isLow = coveragePct != null && coveragePct < 70;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {notice ? (
        <div
          role="alert"
          className={cn(
            "rounded-xl border px-4 py-3 text-sm leading-relaxed",
            isLow
              ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100"
              : "border-sky-500/30 bg-sky-500/10 text-sky-950 dark:text-sky-100",
          )}
        >
          {coveragePct != null ? (
            <span className="mb-1.5 flex items-center gap-2.5">
              <span className="shrink-0 text-xs font-bold tabular-nums">
                Cakupan data {coveragePct}%
              </span>
              <span className="bg-background/50 h-1.5 max-w-40 flex-1 overflow-hidden rounded-full">
                <span
                  className={cn(
                    "block h-full rounded-full",
                    isLow ? "bg-amber-500" : "bg-sky-500",
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, coveragePct))}%` }}
                />
              </span>
            </span>
          ) : null}
          {notice}
        </div>
      ) : null}
      {warnings.map((w) => (
        <p
          key={w}
          className="bg-muted/40 text-muted-foreground rounded-xl px-4 py-2.5 text-xs leading-relaxed"
        >
          {w}
        </p>
      ))}
    </div>
  );
}

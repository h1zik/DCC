"use client";

import { hub } from "@/components/research-hub/research-hub-primitives";
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
        <p
          role="alert"
          className={cn(
            hub.nestedPanel,
            isLow
              ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
              : "border-sky-500/40 bg-sky-500/10 text-sky-950 dark:text-sky-100",
            "text-sm leading-relaxed",
          )}
        >
          {coveragePct != null ? (
            <span className="mr-2 font-semibold tabular-nums">
              Cakupan data {coveragePct}%
            </span>
          ) : null}
          {notice}
        </p>
      ) : null}
      {warnings.map((w) => (
        <p
          key={w}
          className={cn(
            hub.nestedPanel,
            "text-muted-foreground text-xs leading-relaxed",
          )}
        >
          {w}
        </p>
      ))}
    </div>
  );
}

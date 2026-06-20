"use client";

import { cn } from "@/lib/utils";
import { hub } from "@/components/research-hub/research-hub-primitives";
import type { TrendDigestMode } from "@prisma/client";

export function TrendQualityBanner({
  digestMode,
  dataNotice,
  className,
}: {
  digestMode: TrendDigestMode | string | null;
  dataNotice: string | null;
  className?: string;
}) {
  if (!dataNotice && digestMode === "LIVE") return null;

  const isFailed = digestMode === "FAILED";
  const isPartial = digestMode === "PARTIAL";

  return (
    <p
      role="alert"
      className={cn(
        hub.nestedPanel,
        "text-sm leading-relaxed",
        isFailed &&
          "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200",
        isPartial &&
          "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
        !isFailed && !isPartial && "border-sky-500/40 bg-sky-500/10",
        className,
      )}
    >
      {isFailed ? "Digest gagal — " : isPartial ? "Data parsial — " : ""}
      {dataNotice ?? "Kualitas data digest perlu diperhatikan."}
    </p>
  );
}

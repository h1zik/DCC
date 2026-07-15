"use client";

import { cn } from "@/lib/utils";
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
        "rounded-xl border px-4 py-3 text-sm leading-relaxed",
        isFailed &&
          "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200",
        isPartial &&
          "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
        !isFailed &&
          !isPartial &&
          "border-sky-500/30 bg-sky-500/10 text-sky-950 dark:text-sky-100",
        className,
      )}
    >
      <span className="font-semibold">
        {isFailed ? "Digest gagal — " : isPartial ? "Data parsial — " : ""}
      </span>
      {dataNotice ?? "Kualitas data digest perlu diperhatikan."}
    </p>
  );
}

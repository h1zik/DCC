"use client";

import { cn } from "@/lib/utils";

export function KeywordQualityBanner(props: {
  dataNotice: string | null;
  className?: string;
}) {
  if (!props.dataNotice) return null;

  return (
    <p
      className={cn(
        "rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm leading-relaxed text-sky-950 dark:text-sky-100",
        props.className,
      )}
    >
      {props.dataNotice}
    </p>
  );
}

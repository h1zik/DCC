"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function KeywordQualityBanner(props: {
  dataNotice: string | null;
  className?: string;
}) {
  if (!props.dataNotice) return null;

  return (
    <p
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-2xl bg-sky-500/10 px-4 py-3 text-sm leading-relaxed text-sky-900 dark:text-sky-200",
        props.className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{props.dataNotice}</span>
    </p>
  );
}

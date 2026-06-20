"use client";

import { hub } from "@/components/research-hub/research-hub-primitives";
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
        hub.nestedPanel,
        "border-sky-500/40 bg-sky-500/10 text-sm leading-relaxed text-sky-950 dark:text-sky-100",
        props.className,
      )}
    >
      {props.dataNotice}
    </p>
  );
}

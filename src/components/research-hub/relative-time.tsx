"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

/** Waktu relatif aman untuk hydration (hindari mismatch SSR vs client). */
export function RelativeTime({
  date,
  className,
}: {
  date: Date | string | null | undefined;
  className?: string;
}) {
  const [text, setText] = useState("—");

  useEffect(() => {
    const tick = () =>
      setText(formatRelativeTime(date ? new Date(date) : null));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [date]);

  return (
    <span
      suppressHydrationWarning
      className={cn("text-sm font-semibold tabular-nums", className)}
    >
      {text}
    </span>
  );
}

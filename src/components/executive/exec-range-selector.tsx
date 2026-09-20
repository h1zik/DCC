"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

const RANGES = [30, 90, 180] as const;

/** Segmented control rentang hari untuk data barang keluar (`?range=`). */
export function ExecRangeSelector({ value }: { value: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function select(next: number) {
    if (next === value) return;
    startTransition(() => {
      // 90 = default → URL tetap bersih.
      router.replace(next === 90 ? "/" : `/?range=${next}`, { scroll: false });
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Rentang data barang keluar"
      aria-busy={pending}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 shadow-sm transition-opacity",
        pending && "opacity-60",
      )}
    >
      {RANGES.map((r) => {
        const active = r === value;
        return (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() => select(r)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {r} hari
          </button>
        );
      })}
    </div>
  );
}

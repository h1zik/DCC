"use client";

import { cn } from "@/lib/utils";

type Keyword = { word: string; count: number };

/**
 * Awan keyword — chip pill hangat dengan skala ukuran + bobot sesuai
 * frekuensi. Visual-only; dipakai juga brand-hub.
 */
export function KeywordCloud({ keywords }: { keywords: Keyword[] }) {
  if (keywords.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada keyword.</p>
    );
  }

  const max = Math.max(...keywords.map((k) => k.count), 1);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {keywords.map((k) => {
        const ratio = k.count / max;
        const scale = 0.75 + ratio * 0.55;
        const strong = ratio >= 0.6;
        return (
          <span
            key={k.word}
            className={cn(
              "inline-flex items-baseline gap-1.5 rounded-full px-3 py-1 leading-tight",
              strong
                ? "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_14%,transparent)] font-bold text-[var(--lab-accent,var(--primary))]"
                : "bg-muted/60 text-foreground font-medium",
            )}
            style={{ fontSize: `${scale}rem` }}
            title={`${k.count} kali`}
          >
            {k.word}
            <span className="text-muted-foreground text-[0.65em] font-semibold tabular-nums">
              {k.count}
            </span>
          </span>
        );
      })}
    </div>
  );
}

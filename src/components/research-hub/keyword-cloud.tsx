"use client";

import { cn } from "@/lib/utils";

type Keyword = { word: string; count: number };

export function KeywordCloud({ keywords }: { keywords: Keyword[] }) {
  if (keywords.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada keyword.</p>
    );
  }

  const max = Math.max(...keywords.map((k) => k.count), 1);

  return (
    <div className="flex flex-wrap gap-2">
      {keywords.map((k) => {
        const scale = 0.75 + (k.count / max) * 0.75;
        return (
          <span
            key={k.word}
            className={cn(
              "bg-muted text-foreground inline-flex rounded-full px-2.5 py-1 font-medium",
            )}
            style={{ fontSize: `${scale}rem` }}
            title={`${k.count} kali`}
          >
            {k.word}
          </span>
        );
      })}
    </div>
  );
}

"use client";

import { Sparkles } from "lucide-react";

export type GapKeyword = {
  keyword: string;
  volume: number;
  competition: number;
  reason: string;
};

export function KeywordGapList({ gaps }: { gaps: GapKeyword[] }) {
  if (gaps.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada keyword gap terdeteksi.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {gaps.map((g) => (
        <li
          key={g.keyword}
          className="border-border/70 flex gap-3 rounded-lg border p-3"
        >
          <Sparkles className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{g.keyword}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Vol {g.volume.toLocaleString("id-ID")} · Kompetisi{" "}
              {(g.competition * 100).toFixed(0)}%
            </p>
            <p className="text-muted-foreground mt-1 text-sm">{g.reason}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

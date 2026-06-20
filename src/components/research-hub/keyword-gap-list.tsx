"use client";

import { Sparkles } from "lucide-react";
import type { GapKeywordRow } from "@/lib/research/keyword-intel/keyword-signal-types";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { KeywordConfidenceBadge } from "@/components/research-hub/keyword-confidence-badge";
import { cn } from "@/lib/utils";

export type GapKeyword = GapKeywordRow;

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
          className={cn(hub.nestedPanel, "flex gap-3")}
        >
          <Sparkles className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {g.keyword}
              <KeywordConfidenceBadge
                confidence={g.confidence}
                koiScore={g.koiScore}
              />
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Vol{" "}
              {g.volume > 0 ? g.volume.toLocaleString("id-ID") : "—"} · Kompetisi{" "}
              {g.volume > 0 ? `${(g.competition * 100).toFixed(0)}%` : "—"}
              {g.listingSampleCount != null
                ? ` · Sample ${g.listingSampleCount} listing`
                : ""}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">{g.reason}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

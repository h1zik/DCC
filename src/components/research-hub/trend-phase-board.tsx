"use client";

import Link from "next/link";
import { TrendPhase } from "@prisma/client";
import { Globe } from "lucide-react";
import { TREND_PHASE_LABELS } from "@/lib/research/labels";
import { TrendConfidenceBadge } from "@/components/research-hub/trend-confidence-badge";
import { TrendWowBadge } from "@/components/research-hub/trend-wow-badge";
import { cn } from "@/lib/utils";

export type TrendBoardItem = {
  id: string;
  name: string;
  phase: TrendPhase;
  dimension: string;
  isGlobalPipeline: boolean;
  tmiScore?: number | null;
  confidence?: string | null;
  wowStatus?: string | null;
};

const PHASE_STYLES: Record<TrendPhase, { tile: string; dot: string }> = {
  EMERGING: {
    tile: "border-transparent bg-amber-500/8 dark:bg-amber-400/10",
    dot: "bg-amber-400",
  },
  GROWING: {
    tile: "border-transparent bg-emerald-500/8 dark:bg-emerald-400/10",
    dot: "bg-emerald-500",
  },
  PEAK: {
    tile: "border-transparent bg-sky-500/8 dark:bg-sky-400/10",
    dot: "bg-sky-500",
  },
  DECLINING: {
    tile: "border-transparent bg-rose-500/8 dark:bg-rose-400/10",
    dot: "bg-rose-500",
  },
};

const PHASE_ORDER: TrendPhase[] = [
  TrendPhase.EMERGING,
  TrendPhase.GROWING,
  TrendPhase.PEAK,
  TrendPhase.DECLINING,
];

export function TrendPhaseBoard({
  items,
  digestId,
  basePath = "/research-hub/trend-radar",
}: {
  items: TrendBoardItem[];
  digestId: string;
  basePath?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {PHASE_ORDER.map((phase, colIndex) => {
        const phaseItems = items.filter((i) => i.phase === phase);
        const style = PHASE_STYLES[phase];
        return (
          <div
            key={phase}
            className={cn(
              "bento-tile justify-start gap-2.5",
              style.tile,
              "animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none",
            )}
            style={
              colIndex > 0
                ? { animationDelay: `${colIndex * 50}ms` }
                : undefined
            }
          >
            <div className="flex items-center gap-2">
              <span
                className={cn("size-2 shrink-0 rounded-full", style.dot)}
                aria-hidden
              />
              <span className="bento-label text-foreground/80 flex-1">
                {TREND_PHASE_LABELS[phase]}
              </span>
              <span className="bg-card text-foreground rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums shadow-sm">
                {phaseItems.length}
              </span>
            </div>
            {phaseItems.length === 0 ? (
              <p className="text-muted-foreground text-xs">Belum ada tren.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {phaseItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`${basePath}/${digestId}?item=${item.id}`}
                      className="bg-card/70 hover:bg-card block rounded-xl px-2.5 py-2 text-sm shadow-sm transition-colors duration-150 motion-reduce:transition-none"
                    >
                      <span className="font-semibold tracking-tight">
                        {item.name}
                      </span>
                      {item.isGlobalPipeline ? (
                        <Globe
                          className="text-muted-foreground ml-1 inline size-3"
                          aria-label="Global pipeline"
                        />
                      ) : null}
                      <span className="mt-1 flex flex-wrap gap-1">
                        {typeof item.tmiScore === "number" ? (
                          <TrendConfidenceBadge
                            confidence={item.confidence ?? "MED"}
                            tmiScore={item.tmiScore}
                          />
                        ) : null}
                        <TrendWowBadge status={item.wowStatus} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

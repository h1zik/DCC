"use client";

import Link from "next/link";
import { TrendPhase } from "@prisma/client";
import { Globe } from "lucide-react";
import { TREND_PHASE_LABELS } from "@/lib/research/labels";
import { hub } from "@/components/research-hub/research-hub-primitives";
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

const PHASE_STYLES: Record<TrendPhase, string> = {
  EMERGING: "border-amber-500/30 bg-amber-500/5",
  GROWING: "border-emerald-500/30 bg-emerald-500/5",
  PEAK: "border-sky-500/30 bg-sky-500/5",
  DECLINING: "border-rose-500/30 bg-rose-500/5",
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
        return (
          <div
            key={phase}
            className={cn(
              hub.nestedPanel,
              PHASE_STYLES[phase],
              hub.entrance,
            )}
            style={
              colIndex > 0
                ? { animationDelay: `${colIndex * 50}ms` }
                : undefined
            }
          >
            <h3 className="mb-2 text-sm font-semibold">
              {TREND_PHASE_LABELS[phase]}
            </h3>
            {phaseItems.length === 0 ? (
              <p className="text-muted-foreground text-xs">Belum ada tren.</p>
            ) : (
              <ul className="space-y-1.5">
                {phaseItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`${basePath}/${digestId}?item=${item.id}`}
                      className="hover:bg-background/60 block rounded-md px-2 py-1.5 text-sm transition-colors duration-150 motion-reduce:transition-none"
                    >
                      <span className="font-medium">{item.name}</span>
                      {item.isGlobalPipeline ? (
                        <Globe
                          className="text-muted-foreground ml-1 inline size-3"
                          aria-label="Global pipeline"
                        />
                      ) : null}
                      <span className="mt-0.5 flex flex-wrap gap-1">
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

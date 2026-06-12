"use client";

import Link from "next/link";
import { TrendPhase } from "@prisma/client";
import { TREND_PHASE_LABELS } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

export type TrendBoardItem = {
  id: string;
  name: string;
  phase: TrendPhase;
  dimension: string;
  isGlobalPipeline: boolean;
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
}: {
  items: TrendBoardItem[];
  digestId: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {PHASE_ORDER.map((phase) => {
        const phaseItems = items.filter((i) => i.phase === phase);
        return (
          <div
            key={phase}
            className={cn("rounded-xl border p-3", PHASE_STYLES[phase])}
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
                      href={`/research-hub/trend-radar/${digestId}?item=${item.id}`}
                      className="hover:bg-background/60 block rounded-md px-2 py-1.5 text-sm transition-colors"
                    >
                      <span className="font-medium">{item.name}</span>
                      {item.isGlobalPipeline ? (
                        <span className="text-muted-foreground ml-1 text-[10px]">
                          🌏
                        </span>
                      ) : null}
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

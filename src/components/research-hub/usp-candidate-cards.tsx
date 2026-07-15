"use client";

import { FileText, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UspCandidate = {
  usp: string;
  rtb: string;
  differentiationScore: number;
  risks: string[];
};

function scoreTone(score: number) {
  if (score >= 75)
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (score >= 50) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-muted/70 text-muted-foreground";
}

export function UspCandidateCards({
  candidates,
  onCreateBrief,
  onCreateConcept,
  briefPending,
  conceptPending,
}: {
  candidates: UspCandidate[];
  onCreateBrief?: (index: number) => void;
  onCreateConcept?: (index: number) => void;
  briefPending?: boolean;
  conceptPending?: boolean;
}) {
  if (candidates.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Belum ada kandidat USP.</p>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {candidates.map((c, i) => (
        <div key={`usp-${i}`} className="bento-tile justify-start gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-foreground text-base font-bold leading-snug tracking-tight">
              {c.usp}
            </p>
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums",
                scoreTone(c.differentiationScore),
              )}
              title="Skor diferensiasi"
            >
              {c.differentiationScore}
            </span>
          </div>

          <div>
            <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
              Reason to believe
            </p>
            <p className="mt-1 text-sm leading-relaxed">{c.rtb}</p>
          </div>

          {c.risks?.length > 0 ? (
            <div>
              <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                Risiko
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {c.risks.map((r, ri) => (
                  <li
                    key={ri}
                    className="text-muted-foreground flex gap-1.5 text-sm leading-snug"
                  >
                    <span
                      className="bg-rose-400 mt-1.5 size-1.5 shrink-0 rounded-full"
                      aria-hidden
                    />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {onCreateBrief || onCreateConcept ? (
            <div className="border-border/60 mt-auto flex flex-wrap gap-2 border-t pt-3">
              {onCreateBrief ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={briefPending}
                  onClick={() => onCreateBrief(i)}
                >
                  <FileText className="mr-1.5 size-3.5" />
                  Buat Brief
                </Button>
              ) : null}
              {onCreateConcept ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={conceptPending}
                  onClick={() => onCreateConcept(i)}
                >
                  <FlaskConical className="mr-1.5 size-3.5" />
                  Buat Konsep
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

"use client";

import { FileText, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type UspCandidate = {
  usp: string;
  rtb: string;
  differentiationScore: number;
  risks: string[];
};

function scoreTone(score: number) {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
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
    <div className="grid gap-4 lg:grid-cols-2">
      {candidates.map((c, i) => (
        <Card key={`usp-${i}`}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base leading-snug">{c.usp}</CardTitle>
              <span
                className={cn(
                  "shrink-0 text-sm font-bold tabular-nums",
                  scoreTone(c.differentiationScore),
                )}
              >
                {c.differentiationScore}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs font-semibold uppercase">
                RTB
              </p>
              <p className="mt-1 leading-relaxed">{c.rtb}</p>
            </div>
            {c.risks?.length > 0 ? (
              <div>
                <p className="text-muted-foreground text-xs font-semibold uppercase">
                  Risiko
                </p>
                <ul className="mt-1 space-y-0.5">
                  {c.risks.map((r, ri) => (
                    <li key={ri} className="text-muted-foreground">
                      • {r}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

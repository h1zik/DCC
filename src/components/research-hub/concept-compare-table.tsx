import { cn } from "@/lib/utils";

export type CompareDimension = {
  label: string;
  scores: {
    conceptId: string;
    conceptTitle: string;
    score: number;
    note: string;
  }[];
};

/** Pill skor tinted berjenjang (≥75 hijau, ≥50 amber, sisanya netral). */
function scorePillTone(score: number): string {
  if (score >= 75)
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (score >= 50) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-muted/70 text-foreground/80";
}

export function ConceptCompareTable({
  dimensions,
}: {
  dimensions: CompareDimension[];
}) {
  if (dimensions.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      {dimensions.map((dim) => {
        const max = Math.max(...dim.scores.map((s) => s.score), 1);
        return (
          <div key={dim.label} className="flex flex-col gap-2.5">
            <h3 className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
              {dim.label}
            </h3>
            <div className="flex flex-col gap-2.5">
              {dim.scores.map((s) => {
                const isTop = s.score === max;
                return (
                  <div
                    key={`${dim.label}-${s.conceptId}`}
                    className="flex flex-col gap-1"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "w-40 shrink-0 truncate text-sm sm:w-52",
                          isTop
                            ? "text-foreground font-semibold"
                            : "text-muted-foreground font-medium",
                        )}
                        title={s.conceptTitle}
                      >
                        {s.conceptTitle}
                      </span>
                      <div className="bg-muted h-2.5 flex-1 overflow-hidden rounded-full">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            isTop
                              ? "bg-[var(--lab-accent,var(--primary))]"
                              : "bg-muted-foreground/40",
                          )}
                          style={{
                            width: `${Math.max(0, Math.min(100, s.score))}%`,
                          }}
                        />
                      </div>
                      <span
                        className={cn(
                          "inline-flex min-w-11 shrink-0 items-center justify-center rounded-lg px-2 py-1 text-sm font-bold tabular-nums",
                          scorePillTone(s.score),
                        )}
                      >
                        {s.score}
                      </span>
                    </div>
                    {s.note ? (
                      <p className="text-muted-foreground text-xs leading-snug">
                        {s.note}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

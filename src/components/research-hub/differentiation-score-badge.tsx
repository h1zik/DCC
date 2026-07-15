import { cn } from "@/lib/utils";

export function DifferentiationScoreBadge({
  score,
}: {
  score: number | null | undefined;
}) {
  if (score == null) return null;

  const tone =
    score >= 75
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : score >= 50
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-muted/70 text-muted-foreground";

  return (
    <div
      className={cn(
        "inline-flex items-baseline gap-2 rounded-xl px-3.5 py-2",
        tone,
      )}
    >
      <span className="text-2xl font-extrabold tabular-nums tracking-tight">
        {Math.round(score)}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide">
        Diff. score
      </span>
    </div>
  );
}

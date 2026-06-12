import { cn } from "@/lib/utils";

export function DifferentiationScoreBadge({
  score,
}: {
  score: number | null | undefined;
}) {
  if (score == null) return null;

  const tone =
    score >= 75
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : score >= 50
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-border bg-muted text-muted-foreground";

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center rounded-xl border px-6 py-4",
        tone,
      )}
    >
      <span className="text-3xl font-bold tabular-nums">{Math.round(score)}</span>
      <span className="text-xs font-semibold uppercase tracking-wide">
        Differentiation Score
      </span>
    </div>
  );
}

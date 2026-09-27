import { rupiahShort } from "@/lib/kol/format";
import { cn } from "@/lib/utils";

/**
 * Meter budget: terpakai (disetujui s.d. tayang) · menunggu approval ·
 * rencana baru (opsional, dari builder) · sisa. Melebihi budget → merah.
 */
export function BudgetMeter({
  beginning,
  committed,
  pending,
  planned = 0,
  compact,
  className,
}: {
  beginning: number;
  committed: number;
  pending: number;
  planned?: number;
  compact?: boolean;
  className?: string;
}) {
  const safe = Math.max(beginning, 1);
  const approved = Math.max(0, committed - pending);
  const remainingAfter = beginning - committed - planned;
  const over = remainingAfter < 0;
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / safe) * 100))}%`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        className="bg-muted relative flex h-2 w-full overflow-hidden rounded-full"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={beginning}
        aria-valuenow={committed + planned}
        aria-label="Pemakaian budget"
      >
        <span className="h-full bg-[var(--lab-accent,var(--primary))]" style={{ width: pct(approved) }} />
        <span
          className="h-full bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_45%,transparent)]"
          style={{ width: pct(pending) }}
        />
        {planned > 0 ? (
          <span
            className={cn(
              "h-full bg-[repeating-linear-gradient(135deg,currentColor_0_3px,transparent_3px_6px)]",
              over ? "text-red-500" : "text-[var(--lab-accent,var(--primary))]",
            )}
            style={{ width: pct(planned) }}
          />
        ) : null}
      </div>
      {!compact ? (
        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] tabular-nums">
          <span>
            Terpakai {rupiahShort(committed)}
            {pending > 0 ? ` (${rupiahShort(pending)} menunggu)` : ""}
            {planned > 0 ? ` + rencana ${rupiahShort(planned)}` : ""}
          </span>
          <span className={cn("font-semibold", over ? "text-red-600 dark:text-red-400" : "text-foreground")}>
            {over ? `Kurang ${rupiahShort(-remainingAfter)}` : `Sisa ${rupiahShort(remainingAfter)}`}
          </span>
        </div>
      ) : null}
    </div>
  );
}

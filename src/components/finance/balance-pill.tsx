import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatIdrPlain } from "@/lib/finance-format";

type Props = {
  debit: number;
  credit: number;
  className?: string;
};

/**
 * Indikator real-time debit vs kredit di editor jurnal. Jika seimbang →
 * lencana hijau "Seimbang"; jika tidak → lencana merah dengan selisih.
 */
export function BalancePill({ debit, credit, className }: Props) {
  const diff = +(debit - credit).toFixed(2);
  const balanced = diff === 0 && (debit > 0 || credit > 0);
  const empty = debit === 0 && credit === 0;

  if (empty) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground",
          className,
        )}
      >
        Belum ada baris
      </span>
    );
  }

  if (balanced) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300",
          className,
        )}
      >
        <CheckCircle2 className="size-3.5" aria-hidden /> Seimbang ·{" "}
        <span className="tabular-nums">Rp {formatIdrPlain(debit)}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300",
        className,
      )}
    >
      <AlertTriangle className="size-3.5" aria-hidden /> Selisih{" "}
      <span className="tabular-nums">
        {diff > 0 ? "+" : ""}
        {formatIdrPlain(diff)}
      </span>
    </span>
  );
}

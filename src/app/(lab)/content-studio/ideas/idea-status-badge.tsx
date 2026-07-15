import { cn } from "@/lib/utils";

const STATUS: Record<
  string,
  { label: string; pill: string; dot: string; pulse?: boolean }
> = {
  PENDING: {
    label: "Menunggu",
    pill: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
    pulse: true,
  },
  COLLECTING: {
    label: "Mengumpulkan data",
    pill: "bg-blue-500/12 text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
    pulse: true,
  },
  ANALYZING: {
    label: "Menyusun ide",
    pill: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
    pulse: true,
  },
  READY: {
    label: "Siap",
    pill: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  FAILED: {
    label: "Gagal",
    pill: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

/** Pill status dengan titik indikator (berkedip selama proses berjalan). */
export function IdeaSetStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.PENDING;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        s.pill,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          s.dot,
          s.pulse && "animate-pulse motion-reduce:animate-none",
        )}
        aria-hidden
      />
      {s.label}
    </span>
  );
}

/** True selama status masih berproses (UI perlu polling). */
export function isIdeaSetBusy(status: string): boolean {
  return status === "PENDING" || status === "COLLECTING" || status === "ANALYZING";
}

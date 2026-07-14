import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: "Menunggu",
    className: "bg-muted text-muted-foreground",
  },
  COLLECTING: {
    label: "Mengumpulkan data",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  ANALYZING: {
    label: "Menyusun ide",
    className: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
  READY: {
    label: "Siap",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  FAILED: {
    label: "Gagal",
    className: "bg-red-500/10 text-red-700 dark:text-red-300",
  },
};

export function IdeaSetStatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.PENDING;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        s.className,
      )}
    >
      {s.label}
    </span>
  );
}

/** True selama status masih berproses (UI perlu polling). */
export function isIdeaSetBusy(status: string): boolean {
  return status === "PENDING" || status === "COLLECTING" || status === "ANALYZING";
}

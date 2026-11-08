import { cn } from "@/lib/utils";

/**
 * Status run riset yang seragam di semua modul. Tiap modul punya enum status
 * sendiri (READY/SCRAPING/ANALYZING/…); petakan ke salah satu tone ini lalu
 * tampilkan label asli modul.
 */
export type RunTone = "ready" | "running" | "failed" | "idle";

export const RUN_TONE_LABEL: Record<RunTone, string> = {
  ready: "Siap",
  running: "Berjalan",
  failed: "Gagal",
  idle: "Belum jalan",
};

const TONE_TEXT: Record<RunTone, string> = {
  ready: "text-emerald-700 dark:text-emerald-300",
  running: "text-amber-700 dark:text-amber-300",
  failed: "text-rose-700 dark:text-rose-300",
  idle: "text-muted-foreground",
};

/** Petakan string status apa pun ke tone (fallback heuristik berdasarkan nama). */
export function runToneFromStatus(status: string | null | undefined): RunTone {
  const s = (status ?? "").toUpperCase();
  if (!s) return "idle";
  if (/FAIL|ERROR|CANCEL/.test(s)) return "failed";
  if (/READY|DONE|COMPLETE|SUCCE|ACTIVE|PUBLISHED|VALIDATED/.test(s)) return "ready";
  if (/RUN|SCRAP|ANALY|PENDING|QUEUE|PROCESS|SYNC|GENERAT|COLLECT/.test(s)) return "running";
  return "idle";
}

export function RunStatusBadge({
  tone,
  label,
  className,
}: {
  tone: RunTone;
  /** Label status asli modul (mis. "Scraping"). Default: label tone. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap",
        TONE_TEXT[tone],
        className,
      )}
    >
      <span
        className={cn("rh-dot", `rh-tone-${tone}`, tone === "running" && "motion-safe:animate-pulse")}
        aria-hidden
      />
      {label ?? RUN_TONE_LABEL[tone]}
    </span>
  );
}

import type { TrendRadarStatus } from "@prisma/client";
import type { RunTone } from "@/components/research-hub/kit/run-status";

export function isTrendRunning(status: TrendRadarStatus | null | undefined) {
  return status === "COLLECTING" || status === "ANALYZING" || status === "PENDING";
}

export function trendToneOf(status: TrendRadarStatus | null | undefined): RunTone {
  if (status === "READY") return "ready";
  if (status === "FAILED") return "failed";
  if (isTrendRunning(status)) return "running";
  return "idle";
}

/** Rentang minggu digest, mis. "3 Nov – 9 Nov 2026". */
export function formatWeekRange(weekStart: string, weekEnd: string) {
  const start = new Date(weekStart).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
  const end = new Date(weekEnd).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${start} – ${end}`;
}

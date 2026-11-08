"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CompetitorAlertItem = {
  id: string;
  message: string;
  severity: string;
  isRead: boolean;
  createdAt: string;
};

function severityOf(severity: string) {
  const s = severity.toLowerCase();
  if (s === "critical" || s === "high") {
    return { label: "Kritis", tone: "failed", text: "text-rose-700 dark:text-rose-300" };
  }
  if (s === "warning") {
    return { label: "Perhatian", tone: "running", text: "text-amber-700 dark:text-amber-300" };
  }
  return { label: "Info", tone: "idle", text: "text-muted-foreground" };
}

/**
 * Feed alert kompetitor (toko & kategori produk): satu baris per alert,
 * tingkat keparahan sebagai teks + titik, tombol "Tandai dibaca" per baris.
 */
export function CompetitorAlertList({
  alerts,
  pending,
  onMarkRead,
}: {
  alerts: CompetitorAlertItem[];
  pending: boolean;
  onMarkRead: (alert: CompetitorAlertItem) => void;
}) {
  return (
    <ul className="border-border bg-card divide-border/70 max-h-[480px] divide-y overflow-y-auto rounded-xl border">
      {alerts.map((alert) => {
        const sev = severityOf(alert.severity);
        return (
          <li
            key={alert.id}
            className={cn(
              "flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-start sm:gap-4",
              alert.isRead && "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "inline-flex w-24 shrink-0 items-center gap-1.5 pt-0.5 text-xs font-medium",
                sev.text,
              )}
            >
              <span className={cn("rh-dot", `rh-tone-${sev.tone}`)} aria-hidden />
              {sev.label}
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className={cn(!alert.isRead && "text-foreground font-medium")}>
                {!alert.isRead ? <span className="sr-only">Belum dibaca: </span> : null}
                {alert.message}
              </p>
              <p className="rh-meta">
                <time dateTime={alert.createdAt}>
                  {new Date(alert.createdAt).toLocaleString("id-ID")}
                </time>
              </p>
            </div>
            {!alert.isRead ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 self-start"
                disabled={pending}
                onClick={() => onMarkRead(alert)}
              >
                Tandai dibaca
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

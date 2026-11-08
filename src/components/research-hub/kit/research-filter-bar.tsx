"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RUN_TONE_LABEL, type RunTone } from "./run-status";
import type { RunLedgerCounts } from "./run-ledger";

export type RunToneFilter = RunTone | "all";

/**
 * Filter bar seragam Research Hub: cari, filter status (dengan jumlah),
 * slot filter tambahan (Select), jumlah hasil, dan reset. State tetap milik
 * halaman — komponen ini hanya presentasi.
 */
export function ResearchFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Cari…",
  status,
  onStatusChange,
  statusCounts,
  statusLabels,
  children,
  resultCount,
  totalCount,
  onReset,
  className,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  status?: RunToneFilter;
  onStatusChange?: (value: RunToneFilter) => void;
  /** Jumlah per tone; tone tanpa baris disembunyikan. */
  statusCounts?: RunLedgerCounts;
  statusLabels?: Partial<Record<RunTone, string>>;
  children?: React.ReactNode;
  resultCount?: number;
  totalCount?: number;
  /** Tampil hanya bila ada filter aktif. */
  onReset?: () => void;
  className?: string;
}) {
  const tones = (["ready", "running", "failed", "idle"] as RunTone[]).filter(
    (tone) => (statusCounts?.[tone] ?? 0) > 0,
  );
  const filtered = search.trim() !== "" || (status != null && status !== "all");

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2",
        className,
      )}
    >
      <div className="relative w-full sm:w-64">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder.replace(/…$/, "")}
          className="h-9 pl-8 text-sm"
        />
      </div>

      {onStatusChange && tones.length > 1 ? (
        <div
          role="radiogroup"
          aria-label="Filter status"
          className="bg-muted/60 inline-flex items-center rounded-lg p-0.5"
        >
          {(["all", ...tones] as RunToneFilter[]).map((tone) => {
            const active = (status ?? "all") === tone;
            const count =
              tone === "all"
                ? Object.values(statusCounts ?? {}).reduce((a, b) => a + (b ?? 0), 0)
                : (statusCounts?.[tone] ?? 0);
            return (
              <button
                key={tone}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onStatusChange(tone)}
                className={cn(
                  "focus-visible:ring-ring inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tone === "all"
                  ? "Semua"
                  : (statusLabels?.[tone] ?? RUN_TONE_LABEL[tone])}
                <span className="rh-num text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {children}

      <div className="ms-auto flex items-center gap-2">
        {filtered && resultCount != null && totalCount != null ? (
          <p className="rh-meta rh-num" aria-live="polite">
            {resultCount} dari {totalCount}
          </p>
        ) : null}
        {filtered && onReset ? (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <X className="size-3.5" aria-hidden />
            Hapus filter
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Filter baris berdasarkan teks + tone — helper untuk halaman list. */
export function filterRuns<T>(
  rows: T[],
  {
    search,
    status,
    text,
    tone,
  }: {
    search: string;
    status: RunToneFilter;
    text: (row: T) => string;
    tone: (row: T) => RunTone;
  },
): T[] {
  const q = search.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (status === "all" || tone(row) === status) &&
      (q === "" || text(row).toLowerCase().includes(q)),
  );
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type JournalStatusFilter = "all" | "draft" | "posted";

const STATUS_OPTIONS: { value: JournalStatusFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "draft", label: "Draf" },
  { value: "posted", label: "Posted" },
];

export function JournalFilters({
  q,
  status,
  period,
  draftCount,
}: {
  q: string;
  status: JournalStatusFilter;
  /** "YYYY-MM" atau "" bila tanpa filter bulan. */
  period: string;
  draftCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(q);
  const lastPushed = useRef(q);

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  // Debounce pencarian agar URL tidak berganti di setiap ketukan.
  useEffect(() => {
    const next = search.trim();
    if (next === lastPushed.current) return;
    const t = setTimeout(() => {
      lastPushed.current = next;
      update({ q: next || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 transition-opacity",
        pending && "opacity-70",
      )}
    >
      <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nomor, memo, atau referensi"
          aria-label="Cari jurnal"
          className="h-8 pl-8 text-sm"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="hover:text-foreground text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2"
            aria-label="Hapus pencarian"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Filter status jurnal"
        className="bg-muted inline-flex rounded-lg p-0.5"
      >
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={status === opt.value}
            onClick={() => update({ status: opt.value === "all" ? null : opt.value })}
            className={cn(
              "focus-visible:ring-ring/50 rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2",
              status === opt.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
            {opt.value === "draft" && draftCount > 0 ? (
              <span className="ml-1 tabular-nums text-amber-700 dark:text-amber-400">
                {draftCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="inline-flex items-center gap-1">
        <Input
          type="month"
          value={period}
          onChange={(e) => update({ period: e.target.value || null })}
          aria-label="Filter bulan"
          className="h-8 w-40 text-sm"
        />
        {period ? (
          <button
            type="button"
            onClick={() => update({ period: null })}
            className="hover:bg-muted hover:text-foreground text-muted-foreground inline-flex size-7 items-center justify-center rounded-md"
            aria-label="Hapus filter bulan"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

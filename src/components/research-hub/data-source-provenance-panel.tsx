"use client";

import {
  isApifyFallbackProvider,
  providerBadgeTone,
  scrapeProviderLabel,
  type DataProvenanceEntry,
} from "@/lib/research/scrape-data-provider";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";
import { Database } from "lucide-react";

export function DataSourceProvenancePanel({
  entries,
  className,
}: {
  entries: DataProvenanceEntry[];
  className?: string;
}) {
  if (entries.length === 0) return null;

  const hasApifyFallback = entries.some(isApifyFallbackProvider);
  const hasDemo = entries.some((entry) => entry.provider === "demo");

  return (
    <div
      className={cn(
        hub.nestedPanel,
        "flex flex-col gap-2.5 border-dashed",
        className,
      )}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center gap-2">
          <Database className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
            Sumber data
          </p>
        </div>
        <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {entries.map((entry) => {
          const tone = providerBadgeTone(entry.provider, entry.isFallback);
          return (
            <li
              key={`${entry.label}-${entry.provider}`}
              className="bg-card inline-flex items-center gap-1.5 rounded-full py-1 pl-3 pr-1 text-[11px] shadow-sm"
            >
              <span className="text-muted-foreground">{entry.label}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide",
                  tone === "warning" &&
                    "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                  tone === "default" &&
                    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                  tone === "muted" &&
                    "bg-muted text-muted-foreground",
                  tone === "danger" &&
                    "bg-rose-500/15 text-rose-700 dark:text-rose-300",
                )}
              >
                {scrapeProviderLabel(entry.provider)}
              </span>
            </li>
          );
        })}
        </ul>
      </div>
      {hasDemo ? (
        <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-[11px] font-medium leading-relaxed text-rose-800 dark:text-rose-200">
          DATA DEMO (sintetis) — angka di modul ini bukan hasil scrape nyata dan
          TIDAK boleh dipakai untuk keputusan produk. Konfigurasi scraper
          (VPS/Apify) lalu jalankan refresh untuk data asli.
        </p>
      ) : null}
      {hasApifyFallback ? (
        <p className="text-muted-foreground text-[10px] leading-relaxed">
          Apify dipakai sebagai fallback. Jika ini tidak diharapkan, periksa scraper
          VPS (SCRAPER_API_URL) dan log server.
        </p>
      ) : null}
    </div>
  );
}

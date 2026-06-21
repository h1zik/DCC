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

  return (
    <div
      className={cn(
        hub.nestedPanel,
        "flex flex-col gap-2.5 border-dashed",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Database className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
        <p className="text-foreground text-xs font-medium">Sumber data scrape</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {entries.map((entry) => {
          const tone = providerBadgeTone(entry.provider, entry.isFallback);
          return (
            <li
              key={`${entry.label}-${entry.provider}`}
              className="border-border/60 bg-background/80 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px]"
            >
              <span className="text-muted-foreground">{entry.label}</span>
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 font-semibold uppercase tracking-wide",
                  tone === "warning" &&
                    "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
                  tone === "default" &&
                    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
                  tone === "muted" &&
                    "bg-muted text-muted-foreground",
                )}
              >
                {scrapeProviderLabel(entry.provider)}
              </span>
            </li>
          );
        })}
      </ul>
      {hasApifyFallback ? (
        <p className="text-muted-foreground text-[10px] leading-relaxed">
          Apify dipakai sebagai fallback. Jika ini tidak diharapkan, periksa scraper
          VPS (SCRAPER_API_URL) dan log server.
        </p>
      ) : null}
    </div>
  );
}

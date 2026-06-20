"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { listActiveResearchJobs } from "@/actions/research-jobs";
import type { ResearchJobSummary } from "@/actions/research-jobs";
import { cn } from "@/lib/utils";

const POLL_MS = 8_000;

export function BackgroundJobIndicator() {
  const [jobs, setJobs] = useState<ResearchJobSummary[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;

    const tick = async () => {
      try {
        const next = await listActiveResearchJobs();
        if (!active) return;
        setJobs(next);
        setVisible(next.length > 0);
      } catch {
        /* ignore — indicator is non-critical */
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  const shown = jobs.filter((j) => !dismissed.has(j.id));
  if (shown.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-4 right-4 z-40 flex w-72 flex-col gap-2",
        "animate-in fade-in slide-in-from-bottom-2 duration-200",
        "motion-reduce:animate-none motion-reduce:fade-in",
      )}
    >
      {shown.slice(0, 3).map((job) => (
        <div
          key={job.id}
          className="border-border bg-card/95 rounded-xl border p-3 shadow-lg backdrop-blur supports-backdrop-filter:bg-card/80"
        >
          <div className="flex items-start gap-2">
            <Loader2
              className="text-primary mt-0.5 size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-xs font-semibold">
                {job.label}
              </p>
              <p className="text-muted-foreground truncate text-[11px]">
                {job.stepLabel ?? "Memproses di background…"}
              </p>
            </div>
            <button
              type="button"
              aria-label="Sembunyikan"
              className="text-muted-foreground hover:text-foreground -mr-1 -mt-1 rounded p-0.5 transition-colors"
              onClick={() =>
                setDismissed((prev) => {
                  const next = new Set(prev);
                  next.add(job.id);
                  return next;
                })
              }
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
          <div className="bg-muted relative mt-2 h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-primary absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${Math.max(5, Math.min(100, job.percent))}%` }}
            />
          </div>
          <Link
            href={job.href}
            className="text-primary mt-2 inline-block text-[11px] font-medium hover:underline"
          >
            Buka detail →
          </Link>
        </div>
      ))}
    </div>
  );
}
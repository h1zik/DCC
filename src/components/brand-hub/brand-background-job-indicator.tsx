"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  listActiveBrandJobs,
  pollBrandHubBackgroundJobs,
} from "@/actions/brand-jobs";
import type { BrandJobSummary } from "@/actions/brand-jobs";
import { cn } from "@/lib/utils";

const POLL_MS = 10_000;

export function BrandBackgroundJobIndicator() {
  const router = useRouter();
  const [jobs, setJobs] = useState<BrandJobSummary[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const hadJobsRef = useRef(false);

  useEffect(() => {
    let active = true;

    const tick = async () => {
      if (document.visibilityState === "hidden") return;

      try {
        await pollBrandHubBackgroundJobs();
        const next = await listActiveBrandJobs();
        if (!active) return;

        setJobs(next);

        if (hadJobsRef.current && next.length === 0) {
          router.refresh();
        }
        hadJobsRef.current = next.length > 0;
      } catch {
        /* indicator is non-critical */
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

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

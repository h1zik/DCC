"use client";

import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { cn } from "@/lib/utils";

export function TrendDigestProgressStrip({
  subtitle,
}: {
  subtitle?: string | null;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        "animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none",
      )}
    >
      <JobProgressBar
        percent={45}
        title="Digest tren sedang di-generate"
        stepLabel={subtitle}
      />
      <p className="text-muted-foreground px-1 text-xs leading-relaxed">
        Halaman akan diperbarui otomatis setelah digest selesai.
      </p>
    </div>
  );
}

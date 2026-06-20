"use client";

import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";

export function TrendDigestProgressStrip({
  subtitle,
}: {
  subtitle?: string | null;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", hub.entrance)}>
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

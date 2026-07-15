"use client";

import { SocialListeningPlatform } from "@prisma/client";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { hub } from "@/components/research-hub/research-hub-primitives";
import { SOCIAL_LISTENING_PLATFORM_LABELS } from "@/lib/research/labels";
import { cn } from "@/lib/utils";

type PlatformProgress = {
  platform: SocialListeningPlatform;
  status: string | null;
  message: string | null;
};

function platformDotTone(status: string | null) {
  switch (status) {
    case "READY":
      return "bg-emerald-500";
    case "FAILED":
      return "bg-rose-500";
    case "COLLECTING":
      return "bg-amber-500 animate-pulse motion-reduce:animate-none";
    default:
      return "bg-muted-foreground/40";
  }
}

function platformStatusTone(status: string | null) {
  switch (status) {
    case "READY":
      return "text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "text-rose-700 dark:text-rose-300";
    case "COLLECTING":
      return "text-amber-700 dark:text-amber-300";
    default:
      return "text-muted-foreground";
  }
}

export function SocialSyncStatusStrip({
  showProgress,
  progressPercent,
  progressTitle,
  stepLabel,
  progressNote,
  platformProgress,
  className,
}: {
  showProgress: boolean;
  progressPercent: number;
  progressTitle: string;
  stepLabel?: string | null;
  progressNote?: string | null;
  platformProgress: PlatformProgress[];
  className?: string;
}) {
  const hasPlatformStatus = platformProgress.some((p) => p.status != null);
  if (!showProgress && !hasPlatformStatus) return null;

  return (
    <div className={cn("flex flex-col gap-3", hub.entrance, className)}>
      {showProgress ? (
        <div className="flex flex-col gap-1.5">
          <JobProgressBar
            percent={progressPercent}
            stepLabel={stepLabel}
            title={progressTitle}
          />
          {progressNote ? (
            <p className="text-muted-foreground px-1 text-xs leading-relaxed">
              {progressNote}
            </p>
          ) : null}
        </div>
      ) : null}

      {hasPlatformStatus ? (
        <div className="flex flex-wrap gap-2">
          {platformProgress.map(({ platform, status, message }) => (
            <div
              key={platform}
              className="bg-muted/40 inline-flex min-w-0 max-w-full flex-col gap-0.5 rounded-xl px-3.5 py-2.5"
              title={message ?? undefined}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    platformDotTone(status),
                  )}
                  aria-hidden
                />
                <span className="text-xs font-bold tracking-tight">
                  {SOCIAL_LISTENING_PLATFORM_LABELS[platform]}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase",
                    platformStatusTone(status),
                  )}
                >
                  {status ?? "—"}
                </span>
              </div>
              {message ? (
                <p className="text-muted-foreground line-clamp-1 pl-3.5 text-[10px]">
                  {message}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

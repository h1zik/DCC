"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import {
  SocialListeningPlatform,
  SocialListeningStatus,
} from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import {
  SOCIAL_LISTENING_PLATFORM_LABELS,
  SOCIAL_LISTENING_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import {
  hub,
  BrandHubEmptyState,
  BrandHubSection,
  BrandHubStatChip,
} from "@/components/brand-hub/brand-hub-primitives";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { useBrandJobProgress } from "../use-brand-job-progress";
import { cn } from "@/lib/utils";

export type SocialMonitorRow = {
  id: string;
  name: string;
  keywords: string[];
  platforms: SocialListeningPlatform[];
  isActive: boolean;
  latestStatus: SocialListeningStatus | null;
  mentionCount: number;
  thumbnailMentionCount: number;
  collectedAt: string | null;
  errorMessage: string | null;
};

function statusChipTone(
  status: SocialListeningStatus | null,
): "neutral" | "success" | "warning" | "primary" {
  switch (status) {
    case "READY":
      return "success";
    case "FAILED":
      return "warning";
    case "COLLECTING":
    case "ANALYZING":
    case "PENDING":
      return "warning";
    default:
      return "neutral";
  }
}

function isInProgress(status: SocialListeningStatus | null) {
  return (
    status === "COLLECTING" ||
    status === "ANALYZING" ||
    status === "PENDING"
  );
}

export function BrandSocialListeningClient({
  monitors,
}: {
  monitors: SocialMonitorRow[];
}) {
  const brandId = useBrandHubBrandId();

  const hasInProgress = monitors.some((m) => isInProgress(m.latestStatus));
  const readyCount = monitors.filter((m) => m.latestStatus === "READY").length;
  const activeCount = monitors.filter((m) => m.isActive).length;
  const totalMentions = monitors.reduce((sum, m) => sum + m.mentionCount, 0);
  const totalVisual = monitors.reduce(
    (sum, m) => sum + m.thumbnailMentionCount,
    0,
  );

  useBrandJobProgress({ inProgress: hasInProgress });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <BrandHubStatChip
            label="Monitor"
            value={monitors.length.toLocaleString("id-ID")}
            tone="primary"
          />
          <BrandHubStatChip
            label="Aktif"
            value={activeCount.toLocaleString("id-ID")}
            tone="success"
          />
          <BrandHubStatChip
            label="Siap"
            value={readyCount.toLocaleString("id-ID")}
          />
          <BrandHubStatChip
            label="Total mention"
            value={totalMentions.toLocaleString("id-ID")}
          />
          <BrandHubStatChip
            label="Visual"
            value={totalVisual.toLocaleString("id-ID")}
          />
        </div>

        <Badge variant="secondary" className="text-[10px]">
          Dikelola Market Analyst
        </Badge>
      </div>

      {hasInProgress ? (
        <div className={hub.entrance}>
          <JobProgressBar
            title="Sync social listening berjalan"
            percent={40}
            stepLabel="Satu atau lebih monitor sedang mengumpulkan mention dari TikTok & Instagram."
          />
          <p className="text-muted-foreground mt-1.5 px-1 text-xs">
            Halaman diperbarui otomatis setiap beberapa detik.
          </p>
        </div>
      ) : null}

      <BrandHubSection
        title="Monitor Social Listening"
        description="Pantau percakapan organik TikTok & Instagram berdasarkan keyword — data dari Research Hub."
      >
        {monitors.length === 0 ? (
          <BrandHubEmptyState
            icon={MessageSquare}
            title="Belum ada monitor"
            description="Mintakan Market Analyst menambahkan monitor di Research Hub — sistem akan mengumpulkan mention, pain points, wishlist, dan konten viral."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {monitors.map((m, index) => (
              <div
                key={m.id}
                className={cn(
                  hub.panel,
                  hub.cardHover,
                  hub.entrance,
                  !m.isActive && "opacity-80",
                )}
                style={
                  index > 0 && index < 8
                    ? { animationDelay: `${index * 40}ms` }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={brandHubHref(
                        `/brand-hub/social-listening/${m.id}`,
                        brandId,
                      )}
                      className="hover:text-primary text-base font-semibold transition-colors duration-150 motion-reduce:transition-none"
                    >
                      {m.name}
                    </Link>
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                      {m.keywords.join(", ")}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {m.platforms
                        .map((p) => SOCIAL_LISTENING_PLATFORM_LABELS[p])
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <BrandHubStatChip
                      label="Status"
                      value={
                        m.latestStatus
                          ? SOCIAL_LISTENING_STATUS_LABELS[m.latestStatus]
                          : "Belum sync"
                      }
                      tone={statusChipTone(m.latestStatus)}
                    />
                    {!m.isActive ? (
                      <span className="text-muted-foreground text-[10px] font-medium uppercase">
                        Nonaktif
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <BrandHubStatChip
                    label="Mention"
                    value={m.mentionCount.toLocaleString("id-ID")}
                    tone="primary"
                  />
                  <BrandHubStatChip
                    label="Visual"
                    value={m.thumbnailMentionCount.toLocaleString("id-ID")}
                  />
                  <BrandHubStatChip
                    label="Keyword"
                    value={m.keywords.length.toLocaleString("id-ID")}
                  />
                  <BrandHubStatChip
                    label="Sync"
                    value={formatRelativeTime(
                      m.collectedAt ? new Date(m.collectedAt) : null,
                    )}
                  />
                </div>

                {m.errorMessage ? (
                  <p className="text-rose-700 dark:text-rose-300 mt-2 text-xs">
                    {m.errorMessage}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </BrandHubSection>
    </div>
  );
}

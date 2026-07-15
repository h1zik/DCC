"use client";

import Link from "next/link";
import { ArrowUpRight, ImageIcon, MessageSquare } from "lucide-react";
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
import { lab, LabEmptyState, LabSection } from "@/components/lab/lab-primitives";
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

function isInProgress(status: SocialListeningStatus | null) {
  return (
    status === "COLLECTING" ||
    status === "ANALYZING" ||
    status === "PENDING"
  );
}

/** Pill status sync tinted: emerald siap, amber berjalan, rose gagal. */
function StatusPill({ status }: { status: SocialListeningStatus | null }) {
  const running = isInProgress(status);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        status === "READY" &&
          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        status === "FAILED" &&
          "bg-rose-500/15 text-rose-700 dark:text-rose-300",
        running && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        status == null && "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "READY" && "bg-emerald-500",
          status === "FAILED" && "bg-rose-500",
          running && "bg-amber-500 animate-pulse motion-reduce:animate-none",
          status == null && "bg-muted-foreground/50",
        )}
        aria-hidden
      />
      {status ? SOCIAL_LISTENING_STATUS_LABELS[status] : "Belum sync"}
    </span>
  );
}

function CardStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="text-foreground mt-0.5 truncate text-sm font-extrabold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
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
      {/* Strip ringkasan bento */}
      {monitors.length > 0 ? (
        <div
          className={cn(lab.entrance, "grid grid-cols-2 gap-3 lg:grid-cols-4")}
        >
          {/* Hero pink — total mention */}
          <div className="bento-tile border-transparent bg-pink-600 shadow-md shadow-pink-600/20 dark:bg-pink-500">
            <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
              Total mention
            </span>
            <span className="bento-value text-white dark:text-pink-950">
              {totalMentions.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium leading-snug text-pink-100/90 dark:text-pink-900/80">
              dari sync terakhir {monitors.length} monitor
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Monitor aktif</span>
            <span className="bento-value">
              {activeCount}
              <span className="text-muted-foreground/60 text-lg font-bold">
                {" "}
                / {monitors.length}
              </span>
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              ikut sync terjadwal
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Siap dianalisis</span>
            <span className="bento-value">{readyCount}</span>
            <span className="text-muted-foreground text-[11px] font-medium">
              sync terakhir selesai
            </span>
          </div>

          {/* Visual siap harvest — pastel pink */}
          <div className="bento-tile border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
            <span className="text-[11.5px] font-semibold text-pink-800/70 dark:text-pink-200/60">
              Visual
            </span>
            <span className="bento-value text-pink-900 dark:text-pink-300">
              {totalVisual.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-pink-800/60 dark:text-pink-200/50">
              thumbnail siap harvest ke library
            </span>
          </div>
        </div>
      ) : null}

      {hasInProgress ? (
        <div className={lab.entrance}>
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

      <LabSection
        title="Monitor Social Listening"
        description={
          monitors.length === 0
            ? "Monitor sosial dikelola Market Analyst di Research Hub."
            : `${monitors.length} monitor · ${totalMentions.toLocaleString("id-ID")} mention terkumpul dari TikTok & Instagram.`
        }
        action={
          <Badge variant="secondary" className="text-[10px]">
            Dikelola Market Analyst
          </Badge>
        }
      >
        {monitors.length === 0 ? (
          <LabEmptyState
            icon={MessageSquare}
            title="Belum ada monitor"
            description="Mintakan Market Analyst menambahkan monitor di Research Hub — sistem akan mengumpulkan mention, pain points, wishlist, dan konten viral."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {monitors.map((m, index) => (
              <div
                key={m.id}
                className={cn(
                  lab.card,
                  lab.entrance,
                  "group flex flex-col p-0",
                  !m.isActive && "opacity-80",
                )}
                style={
                  index > 0 && index < 8
                    ? { animationDelay: `${index * 40}ms` }
                    : undefined
                }
              >
                <Link
                  href={brandHubHref(
                    `/brand-hub/social-listening/${m.id}`,
                    brandId,
                  )}
                  className="flex flex-1 flex-col gap-4 p-5 pb-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] text-base font-extrabold uppercase text-[var(--lab-accent,var(--primary))]"
                        aria-hidden
                      >
                        {m.name.trim().charAt(0) || "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground flex items-center gap-1 truncate font-bold tracking-tight">
                          <span className="truncate">{m.name}</span>
                          <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors" />
                        </p>
                        <p className="text-muted-foreground line-clamp-1 text-xs">
                          {m.keywords.join(", ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusPill status={m.latestStatus} />
                      {!m.isActive ? (
                        <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase">
                          Nonaktif
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {m.latestStatus === "FAILED" && m.errorMessage ? (
                    <p className="line-clamp-2 text-xs leading-relaxed text-rose-700 dark:text-rose-300">
                      {m.errorMessage}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-4 gap-2">
                    <CardStat
                      label="Mention"
                      value={m.mentionCount.toLocaleString("id-ID")}
                    />
                    <CardStat
                      label="Visual"
                      value={m.thumbnailMentionCount.toLocaleString("id-ID")}
                    />
                    <CardStat
                      label="Keyword"
                      value={m.keywords.length.toLocaleString("id-ID")}
                    />
                    <CardStat
                      label="Sync"
                      value={formatRelativeTime(
                        m.collectedAt ? new Date(m.collectedAt) : null,
                      )}
                    />
                  </div>
                </Link>

                <div className="border-border/60 flex items-center justify-between gap-2 border-t px-5 py-2.5">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 truncate text-xs">
                    <MessageSquare className="size-3.5 shrink-0" aria-hidden />
                    {m.platforms
                      .map((p) => SOCIAL_LISTENING_PLATFORM_LABELS[p])
                      .join(" · ")}
                  </span>
                  {m.thumbnailMentionCount > 0 ? (
                    <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-[11px] tabular-nums">
                      <ImageIcon className="size-3.5" aria-hidden />
                      {m.thumbnailMentionCount.toLocaleString("id-ID")} visual
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </LabSection>
    </div>
  );
}

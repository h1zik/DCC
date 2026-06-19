"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useTransition } from "react";
import { ArrowLeft, ImageIcon } from "lucide-react";
import {
  SocialListeningPlatform,
  SocialListeningStatus,
} from "@prisma/client";
import { toast } from "sonner";
import { harvestSocialVisualsAction } from "@/actions/brand-visual-research";
import { actionErrorMessage } from "@/lib/action-error-message";
import { useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import {
  SentimentBreakdownDonut,
  SentimentTimelineChart,
  ShareOfVoiceChart,
} from "@/components/research-hub/social-insight-charts";
import { SocialCommentFeed, type CommentFeedRow } from "@/components/research-hub/social-comment-feed";
import { SocialCommentInsightsSection } from "@/components/research-hub/social-comment-insights-section";
import { SocialEngagementInsights } from "@/components/research-hub/social-engagement-insights";
import { SocialInfluencerTable } from "@/components/research-hub/social-influencer-table";
import {
  SocialMentionFeed,
  type MentionFeedRow,
} from "@/components/research-hub/social-mention-feed";
import { SocialPainPointsCard } from "@/components/research-hub/social-pain-points-list";
import { SocialViralCards } from "@/components/research-hub/social-viral-cards";
import { SocialWishlistCard } from "@/components/research-hub/social-wishlist-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { statusToProgress } from "@/components/research-hub/job-status-progress";
import {
  SOCIAL_LISTENING_PLATFORM_LABELS,
  SOCIAL_LISTENING_STATUS_LABELS,
} from "@/lib/research/labels";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import type { EngagementInsights } from "@/lib/research/social-listening/social-comment-types";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";

export type SocialDetailData = {
  id: string;
  name: string;
  keywords: string[];
  platforms: SocialListeningPlatform[];
  batchStatus: SocialListeningStatus | null;
  batchId: string | null;
  platformProgress: {
    platform: SocialListeningPlatform;
    status: string | null;
    message: string | null;
  }[];
  errorMessage: string | null;
  aiSummary: string | null;
  topPainPoints: { theme: string; count: number }[];
  topWishlist: { theme: string; count: number }[];
  influencers: {
    author: string;
    platform: string;
    mentions: number;
    totalEngagement: number;
    topUrl: string | null;
  }[];
  viralContent: {
    text: string;
    author: string | null;
    platform: string;
    url: string | null;
    views: number;
    likes: number;
  }[];
  categoryBreakdown: { classification: string; count: number; pct: number }[];
  sentimentTimeline: {
    date: string;
    positive: number;
    negative: number;
    neutral: number;
  }[];
  actionPlan: unknown;
  aiMeta: ResearchAiMetaView | null;
  engagementInsights: EngagementInsights | null;
  commentAiSummary: string | null;
  topCommentPainPoints: { theme: string; count: number }[];
  topCommentWishlist: { theme: string; count: number }[];
  commentCategoryBreakdown: { classification: string; count: number; pct: number }[];
  comments: CommentFeedRow[];
  mentions: MentionFeedRow[];
  thumbnailMentionCount: number;
};

function statusTone(status: SocialListeningStatus | null) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "COLLECTING":
    case "ANALYZING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function BrandSocialDetailClient({ data }: { data: SocialDetailData }) {
  const router = useRouter();
  const brandId = useBrandHubBrandId();
  const [pending, startTransition] = useTransition();

  const inProgress =
    data.batchStatus === "COLLECTING" ||
    data.batchStatus === "ANALYZING" ||
    data.batchStatus === "PENDING";

  const progress = statusToProgress(data.batchStatus ?? "PENDING");
  const collectingPlatforms = data.platformProgress.filter(
    (p) => p.status === "COLLECTING",
  );
  const stepLabel =
    collectingPlatforms.length > 0
      ? collectingPlatforms.map((p) => p.message).filter(Boolean).join(" · ")
      : progress.label;

  const mentionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of data.mentions) {
      counts.set(m.platform, (counts.get(m.platform) ?? 0) + 1);
    }
    return data.platforms.map((p) => ({
      platform: p,
      count: counts.get(p) ?? 0,
    }));
  }, [data.mentions, data.platforms]);

  useEffect(() => {
    if (!inProgress) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [inProgress, router]);

  const canHarvestVisuals = data.thumbnailMentionCount > 0;

  function handleHarvestVisuals() {
    startTransition(async () => {
      try {
        const result = await harvestSocialVisualsAction(data.id, brandId);
        toast.success(`${result.harvested} gambar ditambahkan ke Visual Library.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal harvest visual."));
      }
    });
  }

  return (
    <div className="space-y-6">
      <ResearchModelBadgeGroup meta={data.aiMeta} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/brand-hub/social-listening"
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="size-3" /> Kembali
          </Link>
          <h1 className="text-xl font-semibold">{data.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {data.keywords.join(", ")} ·{" "}
            {data.platforms
              .map((p) => SOCIAL_LISTENING_PLATFORM_LABELS[p])
              .join(", ")}
          </p>
          {data.mentions.length > 0 ? (
            <p className="text-muted-foreground mt-1 text-xs">
              Mention:{" "}
              {mentionCounts
                .map(
                  ({ platform, count }) =>
                    `${SOCIAL_LISTENING_PLATFORM_LABELS[platform]} ${count}`,
                )
                .join(" · ")}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                statusTone(data.batchStatus),
              )}
            >
              {data.batchStatus
                ? SOCIAL_LISTENING_STATUS_LABELS[data.batchStatus]
                : "Belum sync"}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              Dikelola Market Analyst
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleHarvestVisuals}
            disabled={pending || !canHarvestVisuals}
            title={
              canHarvestVisuals
                ? undefined
                : "Batch READY dengan thumbnail diperlukan"
            }
          >
            <ImageIcon className="mr-1.5 size-3.5" />
            Harvest Visuals ({data.thumbnailMentionCount})
          </Button>
        </div>
      </div>

      {inProgress ? (
        <div className="border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10 rounded-lg border px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Sync sedang berjalan di Research Hub. Data di bawah dari batch terakhir
          yang selesai — halaman akan diperbarui otomatis.
        </div>
      ) : null}

      {inProgress ? (
        <JobProgressBar
          percent={progress.percent}
          stepLabel={stepLabel}
          title="Mengumpulkan mention sosial"
        />
      ) : null}

      {(inProgress ||
        data.platformProgress.some((p) => p.status != null)) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Status per platform
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.platformProgress.map(({ platform, status, message }) => (
              <div
                key={platform}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="font-medium">
                  {SOCIAL_LISTENING_PLATFORM_LABELS[platform]}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    status === "READY"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : status === "FAILED"
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                        : status === "COLLECTING"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : "bg-muted text-muted-foreground",
                  )}
                >
                  {status ?? "—"}
                </span>
                {message ? (
                  <p className="text-muted-foreground w-full text-xs">{message}</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data.errorMessage ? (
        <p className="text-amber-700 dark:text-amber-300 text-sm">
          {data.errorMessage}
        </p>
      ) : null}

      {data.aiSummary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm leading-relaxed">
            {data.aiSummary}
          </CardContent>
        </Card>
      ) : null}

      {data.actionPlan ? (
        <ActionPlanPanel plan={data.actionPlan} title="Rencana Aksi Sosial (AI)" />
      ) : null}

      {data.engagementInsights ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Metrik Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <SocialEngagementInsights insights={data.engagementInsights} />
          </CardContent>
        </Card>
      ) : null}

      <SocialCommentInsightsSection
        commentAiSummary={data.commentAiSummary}
        topCommentPainPoints={data.topCommentPainPoints}
        topCommentWishlist={data.topCommentWishlist}
        commentCategoryBreakdown={data.commentCategoryBreakdown}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribusi Sentimen</CardTitle>
          </CardHeader>
          <CardContent>
            <SentimentBreakdownDonut data={data.categoryBreakdown} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tren Sentimen Harian</CardTitle>
          </CardHeader>
          <CardContent>
            <SentimentTimelineChart data={data.sentimentTimeline} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Share of Voice</CardTitle>
          </CardHeader>
          <CardContent>
            <ShareOfVoiceChart
              data={mentionCounts.map((m) => ({
                platform: SOCIAL_LISTENING_PLATFORM_LABELS[m.platform],
                count: m.count,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SocialPainPointsCard items={data.topPainPoints} />
        <SocialWishlistCard items={data.topWishlist} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Influencer Radar</CardTitle>
        </CardHeader>
        <CardContent>
          <SocialInfluencerTable rows={data.influencers} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Viral Content Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <SocialViralCards items={data.viralContent} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mention Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <SocialMentionFeed rows={data.mentions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Analisis Komentar</CardTitle>
        </CardHeader>
        <CardContent>
          <SocialCommentFeed rows={data.comments} />
        </CardContent>
      </Card>
    </div>
  );
}

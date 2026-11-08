"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useTransition } from "react";
import {
  MessageSquare,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import {
  SocialListeningPlatform,
  SocialListeningStatus,
} from "@prisma/client";
import { toast } from "sonner";
import {
  analyzeSocialListeningCommentsAction,
  refreshSocialListeningMonitor,
} from "@/actions/research-social-listening";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import {
  SentimentBreakdownDonut,
  SentimentTimelineChart,
  ShareOfVoiceChart,
} from "@/components/research-hub/social-insight-charts";
import { SocialCommentAnalyzeSection } from "@/components/research-hub/social-comment-analyze-section";
import type { CommentFeedRow } from "@/components/research-hub/social-comment-feed";
import { SocialEngagementInsights } from "@/components/research-hub/social-engagement-insights";
import { SocialInfluencerTable } from "@/components/research-hub/social-influencer-table";
import {
  SocialMentionFeed,
  type MentionFeedRow,
} from "@/components/research-hub/social-mention-feed";
import { SocialPainPointsList } from "@/components/research-hub/social-pain-points-list";
import { SocialSyncStatusStrip } from "@/components/research-hub/social-sync-status-strip";
import { SocialViralCards } from "@/components/research-hub/social-viral-cards";
import { SocialWishlistList } from "@/components/research-hub/social-wishlist-list";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { statusToProgress } from "@/components/research-hub/job-status-progress";
import {
  SOCIAL_LISTENING_PLATFORM_LABELS,
  SOCIAL_LISTENING_STATUS_LABELS,
} from "@/lib/research/labels";
import { lab } from "@/components/lab/lab-primitives";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import type { EngagementInsights } from "@/lib/research/social-listening/social-comment-types";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import { DataSourceProvenancePanel } from "@/components/research-hub/data-source-provenance-panel";
import type { DataProvenanceEntry } from "@/lib/research/scrape-data-provider";
import { RunStatusBadge, type RunTone } from "@/components/research-hub/kit/run-status";
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
import { cn } from "@/lib/utils";
import { DetailSection } from "./detail-section";
import { SocialBriefDialog } from "./social-brief-dialog";
import { SocialDetailOverview } from "./social-detail-overview";
import { SocialScrapeLimits } from "./social-scrape-limits";

export type SocialDetailData = {
  id: string;
  name: string;
  keywords: string[];
  platforms: SocialListeningPlatform[];
  tiktokSearchLimit: number;
  instagramSearchLimit: number;
  batchStatus: SocialListeningStatus | null;
  batchId: string | null;
  dataProvenance: DataProvenanceEntry[];
  platformProgress: {
    platform: SocialListeningPlatform;
    status: string | null;
    message: string | null;
  }[];
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
  rooms: {
    id: string;
    name: string;
    brandId: string | null;
    brandName: string | null;
  }[];
};

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-10 pt-6 duration-200 motion-reduce:animate-none";

function toneOf(status: SocialListeningStatus | null): RunTone {
  if (status === "READY") return "ready";
  if (status === "FAILED") return "failed";
  if (status === "COLLECTING" || status === "ANALYZING" || status === "PENDING") return "running";
  return "idle";
}

export function SocialDetailClient({ data }: { data: SocialDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const inProgress =
    data.batchStatus === "COLLECTING" ||
    data.batchStatus === "PENDING" ||
    (data.batchStatus === "ANALYZING" && data.mentions.length === 0);

  const commentAnalysisInProgress =
    data.batchStatus === "ANALYZING" && data.mentions.length > 0;

  const progress = statusToProgress(data.batchStatus ?? "PENDING");
  const collectingPlatforms = data.platformProgress.filter(
    (p) => p.status === "COLLECTING",
  );
  const stepLabel =
    collectingPlatforms.length > 0
      ? collectingPlatforms.map((p) => p.message).filter(Boolean).join("; ")
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

  const totalMentions = data.mentions.length;
  const showSyncStrip =
    inProgress ||
    commentAnalysisInProgress ||
    data.platformProgress.some((p) => p.status != null);

  useEffect(() => {
    if (!inProgress && !commentAnalysisInProgress) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
    return () => window.clearInterval(id);
  }, [inProgress, commentAnalysisInProgress, router]);

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshSocialListeningMonitor(data.id);
        toast.success("Sync dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Sync gagal dimulai. Coba lagi sebentar lagi."));
      }
    });
  }

  const platformText = data.platforms
    .map((p) => SOCIAL_LISTENING_PLATFORM_LABELS[p])
    .join(", ");
  const noMentionsDescription = inProgress
    ? "Sync pertama sedang berjalan. Halaman ini diperbarui otomatis setelah mention terkumpul."
    : data.batchStatus === "FAILED"
      ? "Sync terakhir gagal. Periksa limit scrape di tab Pengaturan, lalu jalankan sync ulang."
      : "Jalankan sync untuk mengumpulkan mention dari platform yang dipantau.";

  return (
    <ResearchHubDetailPage
      backHref="/research-hub/social-listening"
      title={data.name}
      description={data.keywords.join(", ")}
      meta={
        <>
          <RunStatusBadge
            tone={toneOf(data.batchStatus)}
            label={
              data.batchStatus
                ? SOCIAL_LISTENING_STATUS_LABELS[data.batchStatus]
                : "Belum sync"
            }
          />
          <span>{platformText}</span>
          <ResearchModelBadgeGroup meta={data.aiMeta} />
        </>
      }
      right={
        <>
          <SocialBriefDialog
            monitorId={data.id}
            monitorName={data.name}
            rooms={data.rooms}
            disabled={!data.aiSummary}
          />
          <Button size="sm" onClick={handleRefresh} disabled={pending || inProgress}>
            <RefreshCw
              className={pending ? "motion-safe:animate-spin" : undefined}
              aria-hidden
            />
            {pending ? "Memulai…" : "Sync ulang"}
          </Button>
        </>
      }
    >
      {showSyncStrip ? (
        <div aria-live="polite">
          <SocialSyncStatusStrip
            showProgress={inProgress || commentAnalysisInProgress}
            progressPercent={progress.percent}
            progressTitle={
              commentAnalysisInProgress
                ? "Menganalisis komentar sosial"
                : "Mengumpulkan mention sosial"
            }
            stepLabel={stepLabel}
            progressNote={
              inProgress
                ? "Tab di bawah masih menampilkan sync terakhir yang selesai. Halaman diperbarui otomatis setelah batch ini selesai."
                : commentAnalysisInProgress
                  ? "Komentar diambil dari video teratas. Halaman diperbarui otomatis."
                  : null
            }
            platformProgress={data.platformProgress}
          />
        </div>
      ) : null}

      {totalMentions > 0 ? (
        <SocialDetailOverview
          totalMentions={totalMentions}
          mentionCounts={mentionCounts}
          commentCount={data.comments.length}
          viralCount={data.viralContent.length}
          influencerCount={data.influencers.length}
          categoryBreakdown={data.categoryBreakdown}
        />
      ) : null}

      <Tabs defaultValue="ringkasan" className="gap-0">
        <div className={cn(lab.stickyToolbar, "pb-0")}>
          <TabsList variant="line" className="h-9 w-full justify-start gap-4">
            <TabsTrigger value="ringkasan" className="px-1">
              <Sparkles className="size-3.5" aria-hidden />
              Ringkasan
            </TabsTrigger>
            <TabsTrigger value="mention" className="px-1">
              <MessageSquare className="size-3.5" aria-hidden />
              Mention
              {totalMentions > 0 ? (
                <span className="rh-num text-muted-foreground ml-1 text-xs">
                  {totalMentions}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="komentar" className="px-1">
              Komentar
              {data.comments.length > 0 ? (
                <span className="rh-num text-muted-foreground ml-1 text-xs">
                  {data.comments.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="kreator" className="px-1">
              <Users className="size-3.5" aria-hidden />
              Kreator dan viral
            </TabsTrigger>
            <TabsTrigger value="pengaturan" className="px-1">
              <SlidersHorizontal className="size-3.5" aria-hidden />
              Pengaturan
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ringkasan" className={tabContentClass}>
          {totalMentions === 0 && !data.aiSummary ? (
            <ResearchPanelEmpty
              icon={Sparkles}
              title="Belum ada ringkasan"
              description={noMentionsDescription}
            />
          ) : (
            <>
              {data.aiSummary ? (
                <DetailSection title="Ringkasan AI">
                  <p className="text-foreground/90 max-w-[72ch] text-sm leading-relaxed">
                    {data.aiSummary}
                  </p>
                </DetailSection>
              ) : null}

              {data.actionPlan ? (
                <DetailSection
                  title="Rencana aksi"
                  description="Langkah berikutnya yang disarankan dari analisis AI."
                >
                  <ActionPlanPanel plan={data.actionPlan} title="Rencana aksi sosial" />
                </DetailSection>
              ) : null}

              {data.engagementInsights &&
              data.engagementInsights.scrapedCommentTexts > 0 ? (
                <DetailSection
                  title="Metrik engagement"
                  description="Rata-rata interaksi dan rasio komentar dari mention yang terkumpul."
                >
                  <SocialEngagementInsights insights={data.engagementInsights} />
                </DetailSection>
              ) : null}

              <div className="grid gap-8 lg:grid-cols-3">
                <DetailSection title="Distribusi sentimen">
                  <div className="flex min-h-[240px] items-center justify-center">
                    <SentimentBreakdownDonut data={data.categoryBreakdown} />
                  </div>
                </DetailSection>
                <DetailSection title="Tren sentimen harian">
                  <div className="flex min-h-[240px] items-center">
                    <SentimentTimelineChart data={data.sentimentTimeline} />
                  </div>
                </DetailSection>
                <DetailSection title="Share of voice">
                  <div className="flex min-h-[240px] items-center justify-center">
                    <ShareOfVoiceChart
                      data={mentionCounts.map((m) => ({
                        platform: SOCIAL_LISTENING_PLATFORM_LABELS[m.platform],
                        count: m.count,
                      }))}
                    />
                  </div>
                </DetailSection>
              </div>

              <div className="grid gap-8 lg:grid-cols-2">
                <DetailSection
                  title="Pain point teratas"
                  description="Keluhan yang terdeteksi dari teks mention."
                >
                  <SocialPainPointsList items={data.topPainPoints} />
                </DetailSection>
                <DetailSection
                  title="Wishlist teratas"
                  description="Harapan dan permintaan yang muncul di percakapan."
                >
                  <SocialWishlistList items={data.topWishlist} />
                </DetailSection>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="mention" className={tabContentClass}>
          {totalMentions === 0 ? (
            <ResearchPanelEmpty
              icon={MessageSquare}
              title="Belum ada mention"
              description={noMentionsDescription}
            />
          ) : (
            <DetailSection
              title="Feed mention"
              description="Semua mention yang terkumpul dari platform yang dipantau."
            >
              <SocialMentionFeed rows={data.mentions} />
            </DetailSection>
          )}
        </TabsContent>

        <TabsContent value="komentar" className={tabContentClass}>
          <SocialCommentAnalyzeSection
            monitorId={data.id}
            batchStatus={commentAnalysisInProgress ? "ANALYZING" : data.batchStatus}
            hasMentions={data.mentions.length > 0}
            comments={data.comments}
            insights={{
              commentAiSummary: data.commentAiSummary,
              topCommentPainPoints: data.topCommentPainPoints,
              topCommentWishlist: data.topCommentWishlist,
              commentCategoryBreakdown: data.commentCategoryBreakdown,
            }}
            onAnalyze={analyzeSocialListeningCommentsAction}
          />
        </TabsContent>

        <TabsContent value="kreator" className={tabContentClass}>
          {data.influencers.length === 0 && data.viralContent.length === 0 ? (
            <ResearchPanelEmpty
              icon={Users}
              title="Belum ada kreator atau konten viral"
              description={
                totalMentions === 0
                  ? noMentionsDescription
                  : "Analisis AI belum menemukan akun atau konten yang menonjol di sync terakhir. Tambah keyword atau naikkan limit scrape, lalu sync ulang."
              }
            />
          ) : (
            <div className="grid gap-8 lg:grid-cols-2">
              <DetailSection
                title="Influencer radar"
                description="Akun dengan mention dan engagement tertinggi."
              >
                <SocialInfluencerTable rows={data.influencers} />
              </DetailSection>
              <DetailSection
                title="Konten viral"
                description="Konten dengan engagement terbaik."
              >
                <SocialViralCards items={data.viralContent} />
              </DetailSection>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pengaturan" className={tabContentClass}>
          <SocialScrapeLimits
            monitorId={data.id}
            platforms={data.platforms}
            tiktokSearchLimit={data.tiktokSearchLimit}
            instagramSearchLimit={data.instagramSearchLimit}
          />
          <DataSourceProvenancePanel entries={data.dataProvenance} />
        </TabsContent>
      </Tabs>
    </ResearchHubDetailPage>
  );
}

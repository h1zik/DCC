"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import {
  ArrowLeft,
  ImageIcon,
  MessageSquare,
  Sparkles,
  Users,
} from "lucide-react";
import {
  SocialListeningPlatform,
  SocialListeningStatus,
} from "@prisma/client";
import { toast } from "sonner";
import { harvestSocialVisualsAction } from "@/actions/brand-visual-research";
import { actionErrorMessage } from "@/lib/action-error-message";
import { brandHubHref, useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { useBrandJobProgress } from "../../use-brand-job-progress";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import {
  SentimentBreakdownDonut,
  SentimentTimelineChart,
  ShareOfVoiceChart,
} from "@/components/research-hub/social-insight-charts";
import type { CommentFeedRow } from "@/components/research-hub/social-comment-feed";
import { SocialCommentFeed } from "@/components/research-hub/social-comment-feed";
import { SocialCommentInsightsSection } from "@/components/research-hub/social-comment-insights-section";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { statusToProgress } from "@/components/research-hub/job-status-progress";
import {
  SOCIAL_LISTENING_PLATFORM_LABELS,
  SOCIAL_LISTENING_STATUS_LABELS,
} from "@/lib/research/labels";
import { LabPageHeader, LabSection, lab } from "@/components/lab/lab-primitives";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import type { EngagementInsights } from "@/lib/research/social-listening/social-comment-types";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import type { DataProvenanceEntry } from "@/lib/research/scrape-data-provider";
import { DataSourceProvenancePanel } from "@/components/research-hub/data-source-provenance-panel";
import { cn } from "@/lib/utils";

export type SocialDetailData = {
  id: string;
  name: string;
  keywords: string[];
  platforms: SocialListeningPlatform[];
  batchStatus: SocialListeningStatus | null;
  batchId: string | null;
  dataProvenance: DataProvenanceEntry[];
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

/** Urutan & warna segmen klasifikasi mention untuk stacked bar papan hero. */
const CLASS_SEGMENTS = [
  { key: "PRAISE", label: "Pujian", dot: "bg-emerald-500" },
  { key: "RECOMMENDATION", label: "Rekomendasi", dot: "bg-teal-500" },
  { key: "COMPLAINT", label: "Keluhan", dot: "bg-rose-500" },
  { key: "QUESTION", label: "Pertanyaan", dot: "bg-sky-500" },
  { key: "WISHLIST", label: "Wishlist", dot: "bg-violet-500" },
  { key: "NEUTRAL", label: "Netral", dot: "bg-slate-400 dark:bg-slate-500" },
] as const;

/** Pill status sync tinted untuk header detail. */
function StatusPill({ status }: { status: SocialListeningStatus | null }) {
  const running =
    status === "COLLECTING" || status === "ANALYZING" || status === "PENDING";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
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

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-4 duration-200 motion-reduce:animate-none pt-4";

export function BrandSocialDetailClient({ data }: { data: SocialDetailData }) {
  const router = useRouter();
  const brandId = useBrandHubBrandId();
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

  const totalMentions = data.mentions.length;
  const showSyncStrip =
    inProgress ||
    commentAnalysisInProgress ||
    data.platformProgress.some((p) => p.status != null);

  const canHarvestVisuals = data.thumbnailMentionCount > 0;

  const classTotal = useMemo(
    () =>
      Math.max(
        data.categoryBreakdown.reduce((sum, c) => sum + c.count, 0),
        1,
      ),
    [data.categoryBreakdown],
  );

  useBrandJobProgress({
    inProgress: inProgress || commentAnalysisInProgress,
  });

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

  const headerDescription = `${data.keywords.join(", ")} · ${data.platforms
    .map((p) => SOCIAL_LISTENING_PLATFORM_LABELS[p])
    .join(", ")}`;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <Link
        href={brandHubHref("/brand-hub/social-listening", brandId)}
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Kembali ke Social Listening
      </Link>

      <LabPageHeader
        variant="detail"
        icon={MessageSquare}
        eyebrow="Social Listening"
        title={data.name}
        description={headerDescription}
        right={
          <>
            <StatusPill status={data.batchStatus} />
            <ResearchModelBadgeGroup meta={data.aiMeta} />
            <Badge variant="secondary" className="text-[10px]">
              Dikelola Market Analyst
            </Badge>
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
          </>
        }
      />

      {showSyncStrip ? (
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
              ? "Feed menampilkan data sync terakhir yang selesai — akan diperbarui otomatis setelah batch selesai."
              : commentAnalysisInProgress
                ? "Mengambil komentar dari video teratas via Apify. Halaman akan refresh otomatis."
                : null
          }
          platformProgress={data.platformProgress}
        />
      ) : null}

      {/* Papan hero bento */}
      {totalMentions > 0 ? (
        <div
          className={cn(
            lab.entrance,
            "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4",
          )}
        >
          {/* Total mention — hero pink */}
          <div className="bento-tile col-span-2 row-span-2 border-transparent bg-pink-600 shadow-md shadow-pink-600/20 lg:col-span-1 dark:bg-pink-500">
            <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
              Total mention
            </span>
            <span className="bento-value text-5xl text-white dark:text-pink-950">
              {totalMentions.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium leading-snug text-pink-100/90 dark:text-pink-900/80">
              {mentionCounts
                .map(
                  (m) =>
                    `${m.count.toLocaleString("id-ID")} ${SOCIAL_LISTENING_PLATFORM_LABELS[m.platform]}`,
                )
                .join(" · ")}
            </span>
          </div>

          {/* Distribusi klasifikasi — stacked bar */}
          <div className="bento-tile col-span-2 row-span-2 justify-start gap-2.5">
            <div className="flex items-center justify-between">
              <span className="bento-label">Klasifikasi mention</span>
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {totalMentions.toLocaleString("id-ID")} mention
              </span>
            </div>
            {data.categoryBreakdown.length === 0 ? (
              <p className="text-muted-foreground m-auto text-center text-sm">
                Klasifikasi muncul setelah analisis AI selesai.
              </p>
            ) : (
              <>
                <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
                  {CLASS_SEGMENTS.map((s) => {
                    const row = data.categoryBreakdown.find(
                      (c) => c.classification === s.key,
                    );
                    if (!row || row.count === 0) return null;
                    return (
                      <div
                        key={s.key}
                        className={s.dot}
                        style={{ width: `${(row.count / classTotal) * 100}%` }}
                        title={`${s.label}: ${row.count}`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-col gap-1">
                  {CLASS_SEGMENTS.map((s) => {
                    const row = data.categoryBreakdown.find(
                      (c) => c.classification === s.key,
                    );
                    if (!row) return null;
                    return (
                      <div
                        key={s.key}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span
                          className={cn("size-2 shrink-0 rounded-full", s.dot)}
                          aria-hidden
                        />
                        <span className="text-muted-foreground flex-1">
                          {s.label}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {row.count.toLocaleString("id-ID")}
                        </span>
                        <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
                          {Math.round((row.count / classTotal) * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Komentar teranalisis */}
          <div className="bento-tile">
            <span className="bento-label">Komentar teranalisis</span>
            <span className="bento-value">
              {data.comments.length.toLocaleString("id-ID")}
            </span>
            <span className="text-muted-foreground text-[11px] font-medium">
              dari video/post teratas
            </span>
          </div>

          {/* Visual siap harvest — pastel pink */}
          <div className="bento-tile border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
            <span className="text-[11.5px] font-semibold text-pink-800/70 dark:text-pink-200/60">
              Visual siap harvest
            </span>
            <span className="bento-value text-pink-900 dark:text-pink-300">
              {data.thumbnailMentionCount.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium text-pink-800/60 dark:text-pink-200/50">
              {data.viralContent.length} konten viral · {data.influencers.length}{" "}
              kreator
            </span>
          </div>
        </div>
      ) : null}

      <DataSourceProvenancePanel entries={data.dataProvenance} />

      {data.errorMessage ? (
        <p
          className={cn(
            lab.nestedPanel,
            "text-amber-800 dark:text-amber-200 text-sm",
          )}
          role="alert"
        >
          {data.errorMessage}
        </p>
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
                <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
                  {totalMentions}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="komentar" className="px-1">
              Komentar
              {data.comments.length > 0 ? (
                <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
                  {data.comments.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="kreator" className="px-1">
              <Users className="size-3.5" aria-hidden />
              Kreator & Viral
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ringkasan" className={tabContentClass}>
          {data.aiSummary ? (
            <section className={cn(lab.entrance, "bento-tile justify-start gap-3")}>
              <p className="bento-label">AI Summary</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {data.aiSummary}
              </p>
            </section>
          ) : null}

          {data.actionPlan ? (
            <LabSection
              title="Rencana Aksi"
              description="Rekomendasi langkah berikutnya dari analisis AI."
              delayMs={50}
            >
              <ActionPlanPanel plan={data.actionPlan} title="Rencana Aksi Sosial (AI)" />
            </LabSection>
          ) : null}

          {data.engagementInsights &&
          data.engagementInsights.scrapedCommentTexts > 0 ? (
            <section className="bento-tile justify-start gap-3">
              <div>
                <p className="bento-label">Metrik engagement</p>
                <p className="text-muted-foreground text-xs">
                  Rata-rata interaksi dan rasio komentar dari mention yang
                  terkumpul.
                </p>
              </div>
              <SocialEngagementInsights insights={data.engagementInsights} />
            </section>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-3">
            <section className="bento-tile min-h-[300px] justify-start gap-3">
              <p className="bento-label">Distribusi sentimen</p>
              <div className="flex flex-1 items-center justify-center">
                <SentimentBreakdownDonut data={data.categoryBreakdown} />
              </div>
            </section>
            <section className="bento-tile min-h-[300px] justify-start gap-3">
              <p className="bento-label">Tren sentimen harian</p>
              <div className="flex flex-1 items-center">
                <SentimentTimelineChart data={data.sentimentTimeline} />
              </div>
            </section>
            <section className="bento-tile min-h-[300px] justify-start gap-3">
              <p className="bento-label">Share of voice</p>
              <div className="flex flex-1 items-center justify-center">
                <ShareOfVoiceChart
                  data={mentionCounts.map((m) => ({
                    platform: SOCIAL_LISTENING_PLATFORM_LABELS[m.platform],
                    count: m.count,
                  }))}
                />
              </div>
            </section>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="bento-tile justify-start gap-3">
              <div>
                <p className="bento-label">Top pain points</p>
                <p className="text-muted-foreground text-xs">
                  Keluhan yang terdeteksi dari teks mention.
                </p>
              </div>
              <SocialPainPointsList items={data.topPainPoints} />
            </section>
            <section className="bento-tile justify-start gap-3">
              <div>
                <p className="bento-label">Top wishlist</p>
                <p className="text-muted-foreground text-xs">
                  Harapan & permintaan yang muncul di percakapan.
                </p>
              </div>
              <SocialWishlistList items={data.topWishlist} />
            </section>
          </div>
        </TabsContent>

        <TabsContent value="mention" className={tabContentClass}>
          <section className="bento-tile justify-start gap-3">
            <div>
              <p className="bento-label">Mention feed</p>
              <p className="text-muted-foreground text-xs">
                Semua mention yang terkumpul dari platform yang dipantau.
              </p>
            </div>
            <SocialMentionFeed rows={data.mentions} />
          </section>
        </TabsContent>

        <TabsContent value="komentar" className={tabContentClass}>
          <SocialCommentInsightsSection
            commentAiSummary={data.commentAiSummary}
            topCommentPainPoints={data.topCommentPainPoints}
            topCommentWishlist={data.topCommentWishlist}
            commentCategoryBreakdown={data.commentCategoryBreakdown}
          />
          {data.comments.length > 0 ? (
            <section className="bento-tile justify-start gap-3">
              <p className="bento-label">Feed komentar</p>
              <SocialCommentFeed rows={data.comments} />
            </section>
          ) : null}
        </TabsContent>

        <TabsContent value="kreator" className={tabContentClass}>
          <div className="grid gap-3 lg:grid-cols-2">
            <section className="bento-tile justify-start gap-3">
              <div>
                <p className="bento-label">Influencer radar</p>
                <p className="text-muted-foreground text-xs">
                  Akun dengan mention dan engagement tertinggi.
                </p>
              </div>
              <SocialInfluencerTable rows={data.influencers} />
            </section>
            <section className="bento-tile justify-start gap-3">
              <div>
                <p className="bento-label">Viral content tracker</p>
                <p className="text-muted-foreground text-xs">
                  Konten dengan performa engagement terbaik.
                </p>
              </div>
              <SocialViralCards items={data.viralContent} />
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  FileText,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import {
  SocialListeningPlatform,
  SocialListeningStatus,
} from "@prisma/client";
import { toast } from "sonner";
import { createProductBriefFromSocialInsight } from "@/actions/research-brief";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { statusToProgress } from "@/components/research-hub/job-status-progress";
import {
  SOCIAL_LISTENING_PLATFORM_LABELS,
  SOCIAL_LISTENING_STATUS_LABELS,
} from "@/lib/research/labels";
import {
  hub,
  ResearchHubPageHeader,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import type { EngagementInsights } from "@/lib/research/social-listening/social-comment-types";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import { cn } from "@/lib/utils";

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
  rooms: {
    id: string;
    name: string;
    brandId: string | null;
    brandName: string | null;
  }[];
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

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-6 duration-200 motion-reduce:animate-none pt-4";

export function SocialDetailClient({ data }: { data: SocialDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [briefOpen, setBriefOpen] = useState(false);
  const [insightType, setInsightType] = useState<"pain" | "wishlist" | "viral">(
    "pain",
  );
  const [roomId, setRoomId] = useState(data.rooms[0]?.id ?? "");
  const [projectName, setProjectName] = useState(`Social: ${data.name}`);

  const selectedRoom = data.rooms.find((r) => r.id === roomId);
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

  useEffect(() => {
    if (!inProgress && !commentAnalysisInProgress) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [inProgress, commentAnalysisInProgress, router]);

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshSocialListeningMonitor(data.id);
        toast.success("Sync dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      }
    });
  }

  function handleBrief() {
    if (!selectedRoom?.brandId) {
      toast.error("Pilih room dengan brand.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProductBriefFromSocialInsight({
          monitorId: data.id,
          insightType,
          roomId,
          brandId: selectedRoom.brandId!,
          projectName,
        });
        toast.success("Product brief dibuat.");
        setBriefOpen(false);
        router.push(`/projects/${result.projectId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat brief."));
      }
    });
  }

  const headerDescription = `${data.keywords.join(", ")} · ${data.platforms
    .map((p) => SOCIAL_LISTENING_PLATFORM_LABELS[p])
    .join(", ")}`;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <Link
        href="/research-hub/social-listening"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs transition-colors duration-150 motion-reduce:transition-none"
      >
        <MessageSquare className="size-3" aria-hidden />
        Kembali ke Social Listening
      </Link>

      <ResearchHubPageHeader
        variant="detail"
        icon={MessageSquare}
        eyebrow="Social Listening"
        title={data.name}
        description={headerDescription}
        right={
          <>
            <ResearchModelBadgeGroup meta={data.aiMeta} />
            <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
              <DialogTrigger
                render={
                  <Button size="sm" variant="outline" disabled={!data.aiSummary}>
                    <FileText className="mr-1.5 size-3.5" />
                    Buat Brief
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Buat Product Brief dari Social Insight</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-2">
                    <Label>Jenis insight</Label>
                    <Select
                      value={insightType}
                      onValueChange={(v) =>
                        setInsightType(v as "pain" | "wishlist" | "viral")
                      }
                    >
                      <SelectTrigger />
                      <SelectContent>
                        <SelectItem value="pain">Top Pain Points</SelectItem>
                        <SelectItem value="wishlist">Top Wishlist</SelectItem>
                        <SelectItem value="viral">Viral Content</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Room</Label>
                    <Select
                      value={roomId}
                      onValueChange={(v) => v && setRoomId(v)}
                    >
                      <SelectTrigger />
                      <SelectContent>
                        {data.rooms.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nama proyek</Label>
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleBrief} disabled={pending}>
                    Buat Brief
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button size="sm" onClick={handleRefresh} disabled={pending}>
              <RefreshCw className="mr-1.5 size-3.5" />
              Refresh
            </Button>
          </>
        }
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <ResearchHubStatChip
              label="Status"
              value={
                data.batchStatus
                  ? SOCIAL_LISTENING_STATUS_LABELS[data.batchStatus]
                  : "Belum sync"
              }
              tone={statusChipTone(data.batchStatus)}
            />
            <ResearchHubStatChip
              label="Total mention"
              value={totalMentions.toLocaleString("id-ID")}
              tone="primary"
            />
            {mentionCounts.map(({ platform, count }) => (
              <ResearchHubStatChip
                key={platform}
                label={SOCIAL_LISTENING_PLATFORM_LABELS[platform]}
                value={count.toLocaleString("id-ID")}
              />
            ))}
          </div>
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

      {data.errorMessage ? (
        <p
          className={cn(
            hub.nestedPanel,
            "text-amber-800 dark:text-amber-200 text-sm",
          )}
          role="alert"
        >
          {data.errorMessage}
        </p>
      ) : null}

      <Tabs defaultValue="ringkasan" className="gap-0">
        <div className={cn(hub.stickyToolbar, "pb-0")}>
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
            <ResearchHubSection title="AI Summary" delayMs={0}>
              <div className={cn(hub.panel, "text-muted-foreground text-sm leading-relaxed")}>
                {data.aiSummary}
              </div>
            </ResearchHubSection>
          ) : null}

          {data.actionPlan ? (
            <ResearchHubSection
              title="Rencana Aksi"
              description="Rekomendasi langkah berikutnya dari analisis AI."
              delayMs={50}
            >
              <ActionPlanPanel plan={data.actionPlan} title="Rencana Aksi Sosial (AI)" />
            </ResearchHubSection>
          ) : null}

          {data.engagementInsights &&
          data.engagementInsights.scrapedCommentTexts > 0 ? (
            <ResearchHubSection
              title="Metrik Engagement"
              description="Rata-rata interaksi dan rasio komentar dari mention yang terkumpul."
              delayMs={100}
            >
              <div className={hub.panel}>
                <SocialEngagementInsights insights={data.engagementInsights} />
              </div>
            </ResearchHubSection>
          ) : null}

          <ResearchHubSection
            title="Analitik Sentimen"
            description="Distribusi klasifikasi, tren harian, dan share of voice per platform."
            delayMs={150}
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <div className={cn(hub.panel, "flex min-h-[280px] flex-col")}>
                <p className="mb-3 text-sm font-medium">Distribusi Sentimen</p>
                <div className="flex flex-1 items-center justify-center">
                  <SentimentBreakdownDonut data={data.categoryBreakdown} />
                </div>
              </div>
              <div className={cn(hub.panel, "flex min-h-[280px] flex-col")}>
                <p className="mb-3 text-sm font-medium">Tren Sentimen Harian</p>
                <div className="flex flex-1 items-center">
                  <SentimentTimelineChart data={data.sentimentTimeline} />
                </div>
              </div>
              <div className={cn(hub.panel, "flex min-h-[280px] flex-col")}>
                <p className="mb-3 text-sm font-medium">Share of Voice</p>
                <div className="flex flex-1 items-center justify-center">
                  <ShareOfVoiceChart
                    data={mentionCounts.map((m) => ({
                      platform: SOCIAL_LISTENING_PLATFORM_LABELS[m.platform],
                      count: m.count,
                    }))}
                  />
                </div>
              </div>
            </div>
          </ResearchHubSection>

          <ResearchHubSection
            title="Tema dari Mention"
            description="Pain points dan wishlist yang terdeteksi dari teks mention."
            delayMs={200}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={hub.panel}>
                <p className="mb-3 text-sm font-medium">Top Pain Points</p>
                <SocialPainPointsList items={data.topPainPoints} />
              </div>
              <div className={hub.panel}>
                <p className="mb-3 text-sm font-medium">Top Wishlist</p>
                <SocialWishlistList items={data.topWishlist} />
              </div>
            </div>
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="mention" className={tabContentClass}>
          <ResearchHubSection
            title="Mention Feed"
            description="Semua mention yang terkumpul dari platform yang dipantau."
          >
            <div className={hub.panel}>
              <SocialMentionFeed rows={data.mentions} />
            </div>
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="komentar" className={tabContentClass}>
          <SocialCommentAnalyzeSection
            monitorId={data.id}
            batchStatus={
              commentAnalysisInProgress ? "ANALYZING" : data.batchStatus
            }
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
          <div className="grid gap-6 lg:grid-cols-2">
            <ResearchHubSection
              title="Influencer Radar"
              description="Akun dengan mention dan engagement tertinggi."
            >
              <div className={hub.panel}>
                <SocialInfluencerTable rows={data.influencers} />
              </div>
            </ResearchHubSection>
            <ResearchHubSection
              title="Viral Content Tracker"
              description="Konten dengan performa engagement terbaik."
            >
              <div className={hub.panel}>
                <SocialViralCards items={data.viralContent} />
              </div>
            </ResearchHubSection>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

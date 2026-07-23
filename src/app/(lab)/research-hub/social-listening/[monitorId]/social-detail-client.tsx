"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  FileText,
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
import { createProductBriefFromSocialInsight } from "@/actions/research-brief";
import {
  analyzeSocialListeningCommentsAction,
  refreshSocialListeningMonitor,
  updateSocialListeningMonitorSearchLimits,
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
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { statusToProgress } from "@/components/research-hub/job-status-progress";
import {
  SOCIAL_LISTENING_PLATFORM_LABELS,
  SOCIAL_LISTENING_STATUS_LABELS,
} from "@/lib/research/labels";
import { lab, LabSection } from "@/components/lab/lab-primitives";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import type { EngagementInsights } from "@/lib/research/social-listening/social-comment-types";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import {
  MAX_INSTAGRAM_SEARCH_LIMIT,
  MAX_TIKTOK_SEARCH_LIMIT,
  parseSearchLimitInput,
} from "@/lib/research/social-listening/search-limits-public";
import { DataSourceProvenancePanel } from "@/components/research-hub/data-source-provenance-panel";
import type { DataProvenanceEntry } from "@/lib/research/scrape-data-provider";
import { cn } from "@/lib/utils";

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

export function SocialDetailClient({ data }: { data: SocialDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [briefOpen, setBriefOpen] = useState(false);
  const [insightType, setInsightType] = useState<"pain" | "wishlist" | "viral">(
    "pain",
  );
  const [roomId, setRoomId] = useState(data.rooms[0]?.id ?? "");
  const [projectName, setProjectName] = useState(`Social: ${data.name}`);
  const [tiktokLimit, setTiktokLimit] = useState(String(data.tiktokSearchLimit));
  const [instagramLimit, setInstagramLimit] = useState(
    String(data.instagramSearchLimit),
  );
  const [limitsDirty, setLimitsDirty] = useState(false);

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

  const classTotal = useMemo(
    () =>
      Math.max(
        data.categoryBreakdown.reduce((sum, c) => sum + c.count, 0),
        1,
      ),
    [data.categoryBreakdown],
  );

  useEffect(() => {
    if (!inProgress && !commentAnalysisInProgress) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
    return () => window.clearInterval(id);
  }, [inProgress, commentAnalysisInProgress, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sinkron input limit dengan nilai server pasca refresh
    setTiktokLimit(String(data.tiktokSearchLimit));
    setInstagramLimit(String(data.instagramSearchLimit));
    setLimitsDirty(false);
  }, [data.tiktokSearchLimit, data.instagramSearchLimit]);

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

  function handleSaveLimits() {
    startTransition(async () => {
      try {
        await updateSocialListeningMonitorSearchLimits({
          monitorId: data.id,
          tiktokSearchLimit: parseSearchLimitInput(
            tiktokLimit,
            data.tiktokSearchLimit,
            MAX_TIKTOK_SEARCH_LIMIT,
          ),
          instagramSearchLimit: parseSearchLimitInput(
            instagramLimit,
            data.instagramSearchLimit,
            MAX_INSTAGRAM_SEARCH_LIMIT,
          ),
        });
        setLimitsDirty(false);
        toast.success("Limit scrape disimpan. Refresh untuk pakai nilai baru.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan limit."));
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
    <ResearchHubDetailPage
      icon={MessageSquare}
      backHref="/research-hub/social-listening"
      title={data.name}
      description={headerDescription}
      right={
        <>
          <StatusPill status={data.batchStatus} />
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
                    items={[
                      { value: "pain", label: "Top Pain Points" },
                      { value: "wishlist", label: "Top Wishlist" },
                      { value: "viral", label: "Viral Content" },
                    ]}
                    onValueChange={(v) =>
                      setInsightType(v as "pain" | "wishlist" | "viral")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                    items={data.rooms.map((r) => ({
                      value: r.id,
                      label: r.name,
                    }))}
                    onValueChange={(v) => v && setRoomId(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih room" />
                    </SelectTrigger>
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
    >
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
          {/* Total mention — hero violet */}
          <div className="bento-tile col-span-2 row-span-2 border-transparent bg-violet-600 shadow-md shadow-violet-600/20 lg:col-span-1 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Total mention
            </span>
            <span className="bento-value text-5xl text-white dark:text-violet-950">
              {totalMentions.toLocaleString("id-ID")}
            </span>
            <span className="text-[11px] font-medium leading-snug text-violet-100/90 dark:text-violet-900/80">
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

          {/* Konten viral — amber pastel */}
          <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
            <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
              Konten viral
            </span>
            <span className="bento-value text-amber-900 dark:text-amber-300">
              {data.viralContent.length}
            </span>
            <span className="text-[11px] font-medium text-amber-800/60 dark:text-amber-200/50">
              {data.influencers.length} kreator terdeteksi
            </span>
          </div>
        </div>
      ) : null}

      {/* Limit scrape */}
      <section className={cn(lab.entrance, "bento-tile justify-start gap-3")}>
        <div className="flex items-start gap-2">
          <SlidersHorizontal
            className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
            aria-hidden
          />
          <div>
            <p className="bento-label">Limit scrape</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Berapa banyak video TikTok dan post Instagram diambil per keyword
              (maksimal 5 keyword pertama per sync). Hasil adalah SAMPEL dari
              platform — interpretasikan tema sebagai sinyal, bukan angka
              absolut.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {data.platforms.includes(SocialListeningPlatform.TIKTOK) ? (
            <div className="space-y-2">
              <Label htmlFor="detail-tiktok-limit">Video TikTok per keyword</Label>
              <Input
                id="detail-tiktok-limit"
                type="number"
                min={1}
                max={MAX_TIKTOK_SEARCH_LIMIT}
                value={tiktokLimit}
                onChange={(e) => {
                  setTiktokLimit(e.target.value);
                  setLimitsDirty(true);
                }}
              />
            </div>
          ) : null}
          {data.platforms.includes(SocialListeningPlatform.INSTAGRAM) ? (
            <div className="space-y-2">
              <Label htmlFor="detail-ig-limit">Post Instagram per hashtag</Label>
              <Input
                id="detail-ig-limit"
                type="number"
                min={1}
                max={MAX_INSTAGRAM_SEARCH_LIMIT}
                value={instagramLimit}
                onChange={(e) => {
                  setInstagramLimit(e.target.value);
                  setLimitsDirty(true);
                }}
              />
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !limitsDirty}
            onClick={handleSaveLimits}
          >
            Simpan limit
          </Button>
          <p className="text-muted-foreground text-xs">
            Maks {MAX_TIKTOK_SEARCH_LIMIT} TikTok · {MAX_INSTAGRAM_SEARCH_LIMIT}{" "}
            Instagram per keyword.
          </p>
        </div>
      </section>

      <DataSourceProvenancePanel entries={data.dataProvenance} />

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
    </ResearchHubDetailPage>
  );
}

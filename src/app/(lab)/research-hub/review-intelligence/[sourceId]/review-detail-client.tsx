"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  BarChart3,
  GitCompare,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  exportReviewIntelRawReviewsCsv,
  getReviewIntelRawReviews,
  rescrapeReviewIntelSource,
} from "@/actions/research-review-intelligence";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import { DataSourceProvenancePanel } from "@/components/research-hub/data-source-provenance-panel";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import {
  ComplaintSeverityChart,
  DemographicDonut,
} from "@/components/research-hub/review-enrichment-charts";
import { statusToProgress } from "@/components/research-hub/job-status-progress";
import { KeywordCloud } from "@/components/research-hub/keyword-cloud";
import { ReviewRawDataPanel } from "@/components/research-hub/review-raw-data-panel";
import { ReviewSentimentChart } from "@/components/research-hub/review-sentiment-chart";
import { ReviewTimelineChart } from "@/components/research-hub/review-timeline-chart";
import { ThemeRankList } from "@/components/research-hub/theme-rank-list";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getReviewPlatformLabel } from "@/lib/review-platforms/platforms";
import { SOURCE_STATUS_LABELS } from "@/lib/research/labels";
import { lab } from "@/components/lab/lab-primitives";
import { RelativeTime } from "@/components/research-hub/relative-time";
import { RunStatusBadge, runToneFromStatus } from "@/components/research-hub/kit/run-status";
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
import { cn } from "@/lib/utils";
import { useReviewIntelPolling } from "../use-review-intel-polling";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import type { DataProvenanceEntry } from "@/lib/research/scrape-data-provider";
import { ReviewBriefDialog, type RoomOption } from "./review-brief-dialog";
import { ReviewComparePanel, type CompareOption } from "./review-compare-panel";
import { DetailSection, PartialDataNotice, ReviewOverview } from "./review-overview";

type Theme = { theme: string; count: number };
type Keyword = { word: string; count: number };
type Timeline = {
  month: string;
  positive: number;
  neutral: number;
  negative: number;
};

export type ReviewDetailData = {
  id: string;
  productName: string;
  competitorBrand: string;
  platformKey: string;
  productUrl: string | null;
  marketplace: string | null;
  status: string;
  reviewCount: number;
  totalReviewsReported: number | null;
  reviewsComplete: boolean | null;
  lastAnalyzedAt: string | null;
  aiMeta: ResearchAiMetaView | null;
  dataProvenance: DataProvenanceEntry[];
  summary: {
    positivePct: number;
    neutralPct: number;
    negativePct: number;
    topComplaints: Theme[];
    topPraises: Theme[];
    keywordCloud: Keyword[];
    timelineBuckets: Timeline[];
    gapOpportunity: string | null;
    severityByTheme: { theme: string; avgSeverity: number; count: number }[];
    demographics: {
      skinTypes: { value: string; count: number }[];
      ageBands: { value: string; count: number }[];
      genders: { value: string; count: number }[];
    };
    actionPlan: unknown;
  } | null;
};

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-8 duration-200 motion-reduce:animate-none pt-5";

export function ReviewDetailClient({
  source,
  compareOptions,
  rooms,
}: {
  source: ReviewDetailData;
  compareOptions: CompareOption[];
  rooms: RoomOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inProgress =
    source.status === "SCRAPING" || source.status === "ANALYZING";
  useReviewIntelPolling(inProgress);

  const platformLabel = getReviewPlatformLabel(source.platformKey);
  const statusLabel =
    SOURCE_STATUS_LABELS[source.status as keyof typeof SOURCE_STATUS_LABELS] ??
    source.status;
  const totalReported = source.totalReviewsReported;
  const isPartial = totalReported != null && totalReported > source.reviewCount;
  const progress = statusToProgress(source.status);
  const summary = source.summary;
  const sentiment = summary
    ? {
        positive: summary.positivePct,
        neutral: summary.neutralPct,
        negative: summary.negativePct,
      }
    : null;

  function handleRescrape() {
    startTransition(async () => {
      try {
        await rescrapeReviewIntelSource(source.id);
        toast.success(`"${source.productName}" di-scrape ulang.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal scrape ulang."));
      }
    });
  }

  const rawPanel = (
    <ReviewRawDataPanel
      sourceId={source.id}
      productName={source.productName}
      productUrl={source.productUrl}
      reviewCount={source.reviewCount}
      fetchPage={getReviewIntelRawReviews}
      exportCsv={exportReviewIntelRawReviewsCsv}
      bare
    />
  );

  return (
    <ResearchHubDetailPage
      icon={Star}
      backHref="/research-hub/review-intelligence"
      title={source.productName}
      meta={
        <>
          <RunStatusBadge tone={runToneFromStatus(source.status)} label={statusLabel} />
          <span>{source.competitorBrand}</span>
          <span>{platformLabel}</span>
          <span className="rh-num">
            {source.reviewCount.toLocaleString("id-ID")} review
          </span>
          <span>
            Dianalisis{" "}
            <RelativeTime date={source.lastAnalyzedAt} className="text-xs font-normal" />
          </span>
        </>
      }
      right={
        <>
          <ResearchModelBadgeGroup meta={source.aiMeta} />
          {source.platformKey !== "csv" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || inProgress}
              onClick={handleRescrape}
            >
              <RefreshCw className={cn(pending && "motion-safe:animate-spin")} aria-hidden />
              Scrape ulang
            </Button>
          ) : null}
          {summary ? (
            <ReviewBriefDialog
              sourceId={source.id}
              productName={source.productName}
              rooms={rooms}
            />
          ) : null}
        </>
      }
    >
      {inProgress ? (
        <div aria-live="polite">
          <JobProgressBar
            title={source.status === "SCRAPING" ? "Mengambil review" : "Menganalisis review"}
            percent={progress.percent}
            stepLabel={`${progress.label} Halaman diperbarui otomatis, Anda boleh membuka halaman lain.`}
          />
        </div>
      ) : null}

      {isPartial ? (
        <PartialDataNotice reviewCount={source.reviewCount} totalReported={totalReported} />
      ) : null}

      <DataSourceProvenancePanel entries={source.dataProvenance} />

      {!summary || !sentiment ? (
        <>
          {!inProgress ? (
            <ResearchPanelEmpty
              icon={Sparkles}
              title={
                source.status === "FAILED"
                  ? "Analisis gagal"
                  : "Analisis belum tersedia"
              }
              description={
                source.platformKey === "csv"
                  ? "Review dari CSV belum dianalisis. Impor ulang file CSV dengan kolom text, review, atau ulasan."
                  : "Review belum dianalisis AI. Scrape ulang untuk mengambil review dan menjalankan analisis."
              }
              action={
                source.platformKey !== "csv" ? (
                  <Button size="sm" variant="outline" onClick={handleRescrape} disabled={pending}>
                    <RefreshCw aria-hidden />
                    Scrape ulang
                  </Button>
                ) : undefined
              }
            />
          ) : null}
          {source.reviewCount > 0 ? (
            <DetailSection
              id="rd-raw-pending"
              title="Review mentah"
              description="Review sudah terkumpul. Insight muncul setelah analisis AI selesai."
            >
              {rawPanel}
            </DetailSection>
          ) : null}
        </>
      ) : (
        <>
          <ReviewOverview
            reviewCount={source.reviewCount}
            totalReported={totalReported}
            platformLabel={platformLabel}
            sentiment={sentiment}
            complaintCount={summary.topComplaints.length}
            topComplaint={summary.topComplaints[0]?.theme ?? null}
            praiseCount={summary.topPraises.length}
            topPraise={summary.topPraises[0]?.theme ?? null}
          />

          <ReviewTabs
            source={source}
            summary={summary}
            sentiment={sentiment}
            compareOptions={compareOptions}
            rawPanel={rawPanel}
          />
        </>
      )}
    </ResearchHubDetailPage>
  );
}

function ReviewTabs({
  source,
  summary,
  sentiment,
  compareOptions,
  rawPanel,
}: {
  source: ReviewDetailData;
  summary: NonNullable<ReviewDetailData["summary"]>;
  sentiment: { positive: number; neutral: number; negative: number };
  compareOptions: CompareOption[];
  rawPanel: React.ReactNode;
}) {
  const demographics = summary.demographics;
  const hasDemographics =
    demographics.skinTypes.length > 0 ||
    demographics.ageBands.length > 0 ||
    demographics.genders.length > 0;
  const datedCount = summary.timelineBuckets.reduce(
    (acc, b) => acc + b.positive + b.neutral + b.negative,
    0,
  );
  const undatedCount = Math.max(0, source.reviewCount - datedCount);

  return (
    <Tabs defaultValue="ringkasan" className="gap-0">
      <div className={cn(lab.stickyToolbar, "pb-0")}>
        <TabsList variant="line" className="h-9 w-full justify-start gap-4">
          <TabsTrigger value="ringkasan" className="px-1">
            <Sparkles className="size-3.5" aria-hidden />
            Ringkasan
          </TabsTrigger>
          <TabsTrigger value="tema" className="px-1">
            <MessageSquareText className="size-3.5" aria-hidden />
            Tema
          </TabsTrigger>
          <TabsTrigger value="demografi" className="px-1">
            <Users className="size-3.5" aria-hidden />
            Demografi
          </TabsTrigger>
          <TabsTrigger value="review" className="px-1">
            <BarChart3 className="size-3.5" aria-hidden />
            Review
            {source.reviewCount > 0 ? (
              <span className="rh-num text-muted-foreground ml-1 text-xs">
                {source.reviewCount.toLocaleString("id-ID")}
              </span>
            ) : null}
          </TabsTrigger>
          {compareOptions.length > 0 ? (
            <TabsTrigger value="bandingkan" className="px-1">
              <GitCompare className="size-3.5" aria-hidden />
              Bandingkan
            </TabsTrigger>
          ) : null}
        </TabsList>
      </div>

      <TabsContent value="ringkasan" className={tabContentClass}>
        {summary.actionPlan ? (
          <ActionPlanPanel
            plan={summary.actionPlan}
            title="Rencana aksi"
            emptyHint="Rencana aksi belum tersedia. Jalankan analisis ulang untuk menghasilkan rekomendasi."
          />
        ) : null}

        <div className="grid gap-8 lg:grid-cols-2">
          <DetailSection
            id="rd-gap"
            title="Gap opportunity"
            description="Peluang produk dari celah di review kompetitor."
          >
            {summary.gapOpportunity ? (
              <p className="max-w-[68ch] text-sm leading-relaxed">{summary.gapOpportunity}</p>
            ) : (
              <ResearchPanelEmpty
                title="Belum ada gap opportunity"
                description="AI tidak menemukan celah yang cukup kuat dari review ini. Tambah sumber review kompetitor lain untuk pembanding."
              />
            )}
          </DetailSection>

          <DetailSection
            id="rd-sentiment"
            title="Proporsi sentimen"
            description="Review positif, netral, dan negatif."
          >
            <ReviewSentimentChart
              positivePct={sentiment.positive}
              neutralPct={sentiment.neutral}
              negativePct={sentiment.negative}
            />
          </DetailSection>
        </div>
      </TabsContent>

      <TabsContent value="tema" className={tabContentClass}>
        <div className="grid gap-8 lg:grid-cols-2">
          <DetailSection
            id="rd-complaints"
            title="Keluhan teratas"
            description="Tema keluhan yang paling sering muncul."
          >
            <ThemeRankList
              items={summary.topComplaints}
              emptyLabel="Belum ada keluhan yang bisa dikelompokkan dari review ini."
            />
          </DetailSection>

          <DetailSection
            id="rd-praises"
            title="Pujian teratas"
            description="Tema pujian yang paling sering disebut."
          >
            <ThemeRankList
              items={summary.topPraises}
              emptyLabel="Belum ada pujian yang bisa dikelompokkan dari review ini."
            />
          </DetailSection>
        </div>

        <DetailSection
          id="rd-keywords"
          title="Kata kunci dominan"
          description="Kata yang paling sering muncul di teks review."
        >
          {summary.keywordCloud.length > 0 ? (
            <KeywordCloud keywords={summary.keywordCloud} />
          ) : (
            <ResearchPanelEmpty
              title="Belum ada kata kunci"
              description="Teks review terlalu sedikit atau terlalu pendek untuk diekstrak. Scrape lebih banyak review untuk hasil yang lebih kaya."
            />
          )}
        </DetailSection>

        <DetailSection
          id="rd-severity"
          title="Keparahan keluhan"
          description="Rata-rata tingkat keparahan per tema keluhan."
        >
          {summary.severityByTheme.length > 0 ? (
            <ComplaintSeverityChart items={summary.severityByTheme} />
          ) : (
            <ResearchPanelEmpty
              title="Belum ada skor keparahan"
              description="Skor muncul setelah AI menemukan keluhan yang bisa dikelompokkan."
            />
          )}
        </DetailSection>
      </TabsContent>

      <TabsContent value="demografi" className={tabContentClass}>
        <DetailSection
          id="rd-demographics"
          title="Demografi terinferensi"
          description="Estimasi dari teks review. Perlakukan sebagai sinyal, bukan data presisi."
        >
          {hasDemographics ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <DemographicDonut title="Jenis kulit" items={demographics.skinTypes} />
              <DemographicDonut title="Kelompok umur" items={demographics.ageBands} />
              <DemographicDonut title="Gender" items={demographics.genders} />
            </div>
          ) : (
            <ResearchPanelEmpty
              icon={Users}
              title="Demografi belum terdeteksi"
              description="Reviewer jarang menyebut jenis kulit, umur, atau gender di review ini. Sumber komunitas seperti Female Daily biasanya lebih kaya."
            />
          )}
        </DetailSection>

        <DetailSection
          id="rd-timeline"
          title="Timeline review"
          description="Tren sentimen per bulan. Review tanpa tanggal tidak masuk timeline."
        >
          {summary.timelineBuckets.length > 0 ? (
            <ReviewTimelineChart data={summary.timelineBuckets} />
          ) : (
            <ResearchPanelEmpty
              title="Timeline belum tersedia"
              description="Tidak ada review dengan tanggal valid dari sumber ini."
            />
          )}
          {undatedCount > 0 && summary.timelineBuckets.length > 0 ? (
            <p className="rh-meta">
              {undatedCount.toLocaleString("id-ID")} review tanpa tanggal valid
              tidak tampil di timeline, tetapi tetap dihitung di sentimen dan
              tema.
            </p>
          ) : null}
        </DetailSection>
      </TabsContent>

      <TabsContent value="review" className={tabContentClass}>
        {rawPanel}
      </TabsContent>

      {compareOptions.length > 0 ? (
        <TabsContent value="bandingkan" className={tabContentClass}>
          <ReviewComparePanel
            productName={source.productName}
            sentiment={sentiment}
            options={compareOptions}
          />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

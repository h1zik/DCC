"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  BarChart3,
  FileText,
  GitCompare,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { createProductBriefFromInsight } from "@/actions/research-brief";
import {
  exportReviewIntelRawReviewsCsv,
  getReviewIntelRawReviews,
  rescrapeReviewIntelSource,
} from "@/actions/research-review-intelligence";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import { DataSourceProvenancePanel } from "@/components/research-hub/data-source-provenance-panel";
import { CrossCompareChart } from "@/components/research-hub/cross-compare-chart";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { getReviewPlatformLabel } from "@/lib/review-platforms/platforms";
import {
  SOURCE_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import {
  hub,
  ResearchHubPageHeader,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
import { cn } from "@/lib/utils";
import { useReviewIntelPolling } from "../use-review-intel-polling";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import type { DataProvenanceEntry } from "@/lib/research/scrape-data-provider";

type Theme = { theme: string; count: number };
type Keyword = { word: string; count: number };
type Timeline = {
  month: string;
  positive: number;
  neutral: number;
  negative: number;
};

type CompareOption = {
  id: string;
  productName: string;
  competitorBrand: string;
  positivePct: number;
  neutralPct: number;
  negativePct: number;
};

type RoomOption = {
  id: string;
  name: string;
  brandId: string | null;
  brandName: string | null;
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

function statusChipTone(
  status: string,
): "neutral" | "success" | "warning" | "primary" {
  switch (status) {
    case "READY":
      return "success";
    case "FAILED":
      return "warning";
    case "SCRAPING":
    case "ANALYZING":
      return "warning";
    default:
      return "neutral";
  }
}

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-6 duration-200 motion-reduce:animate-none pt-4";

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
  const [selectedCompare, setSelectedCompare] = useState<string[]>([]);
  const [briefOpen, setBriefOpen] = useState(false);
  const [projectName, setProjectName] = useState(
    `Riset: ${source.productName}`,
  );
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");

  const isPartial =
    source.totalReviewsReported != null &&
    source.totalReviewsReported > source.reviewCount;

  const compareChartData = useMemo(() => {
    const base = source.summary
      ? [
          {
            label: source.productName.slice(0, 20),
            positive: source.summary.positivePct,
            neutral: source.summary.neutralPct,
            negative: source.summary.negativePct,
          },
        ]
      : [];

    for (const id of selectedCompare) {
      const opt = compareOptions.find((o) => o.id === id);
      if (!opt) continue;
      base.push({
        label: opt.productName.slice(0, 20),
        positive: opt.positivePct,
        neutral: opt.neutralPct,
        negative: opt.negativePct,
      });
    }
    return base;
  }, [source, selectedCompare, compareOptions]);

  const selectedRoom = rooms.find((r) => r.id === roomId);
  const statusLabel =
    SOURCE_STATUS_LABELS[
      source.status as keyof typeof SOURCE_STATUS_LABELS
    ] ?? source.status;

  function toggleCompare(id: string) {
    setSelectedCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) {
        toast.error("Maksimal 4 produk perbandingan.");
        return prev;
      }
      return [...prev, id];
    });
  }

  function handleRescrape() {
    startTransition(async () => {
      try {
        await rescrapeReviewIntelSource(source.id);
        toast.success(
          "Scrape dimulai di background. Halaman akan update otomatis.",
        );
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <Link
        href="/research-hub/review-intelligence"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs transition-colors duration-150 motion-reduce:transition-none"
      >
        <Star className="size-3" aria-hidden />
        Kembali ke Review Intelligence
      </Link>

      <ResearchHubPageHeader
        variant="detail"
        icon={Star}
        eyebrow="Review Intelligence"
        title={source.productName}
        description={`${source.competitorBrand} · ${getReviewPlatformLabel(source.platformKey)} · diperbarui ${formatRelativeTime(
          source.lastAnalyzedAt ? new Date(source.lastAnalyzedAt) : null,
        )}`}
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
                <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
                Scrape Ulang
              </Button>
            ) : null}
            {source.summary ? (
              <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
                <DialogTrigger
                  render={
                    <Button size="sm">
                      <FileText className="mr-1.5 size-3.5" aria-hidden />
                      Buat Brief
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Buat Product Brief</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-2">
                    <div className="grid gap-1.5">
                      <Label>Nama proyek</Label>
                      <Input
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Ruangan</Label>
                      <Select
                        value={roomId}
                        onValueChange={(v) => setRoomId(v ?? "")}
                      >
                        <SelectTrigger>
                          {selectedRoom?.name ?? "Pilih ruangan"}
                        </SelectTrigger>
                        <SelectContent>
                          {rooms.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                              {r.brandName ? ` · ${r.brandName}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      disabled={
                        pending ||
                        !projectName.trim() ||
                        !roomId ||
                        !selectedRoom?.brandId
                      }
                      onClick={() =>
                        startTransition(async () => {
                          if (!selectedRoom?.brandId) {
                            toast.error("Ruangan harus punya brand terkait.");
                            return;
                          }
                          try {
                            const result = await createProductBriefFromInsight({
                              sourceId: source.id,
                              roomId,
                              brandId: selectedRoom.brandId,
                              projectName,
                            });
                            toast.success("Brief dibuat di pipeline.");
                            setBriefOpen(false);
                            router.push(`/room/${result.roomId}/tasks`);
                          } catch (err) {
                            toast.error(
                              actionErrorMessage(err, "Gagal memproses permintaan."),
                            );
                          }
                        })
                      }
                    >
                      Buat di Pipeline
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
          </>
        }
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <ResearchHubStatChip
              label="Status"
              value={statusLabel}
              tone={statusChipTone(source.status)}
            />
            <ResearchHubStatChip
              label="Review"
              value={source.reviewCount.toLocaleString("id-ID")}
              tone="primary"
            />
            {source.summary ? (
              <>
                <ResearchHubStatChip
                  label="Positif"
                  value={`${source.summary.positivePct.toFixed(0)}%`}
                  tone="success"
                />
                <ResearchHubStatChip
                  label="Negatif"
                  value={`${source.summary.negativePct.toFixed(0)}%`}
                  tone={
                    source.summary.negativePct > 30 ? "warning" : "neutral"
                  }
                />
              </>
            ) : null}
            {isPartial ? (
              <ResearchHubStatChip
                label="Cakupan"
                value={`${Math.round((source.reviewCount / source.totalReviewsReported!) * 100)}%`}
                tone="warning"
              />
            ) : null}
          </div>
        }
      />

      {inProgress ? (
        <div className={hub.entrance}>
          <JobProgressBar
            title={
              source.status === "SCRAPING"
                ? "Scraping review"
                : "Menganalisis review"
            }
            percent={statusToProgress(source.status).percent}
            stepLabel={`${statusToProgress(source.status).label} — halaman refresh otomatis, kamu boleh lanjut browsing.`}
          />
        </div>
      ) : null}

      {isPartial ? (
        <div
          className={cn(
            hub.nestedPanel,
            "flex items-start gap-2 border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
          )}
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-xs leading-relaxed">
            <span className="font-semibold">Data parsial.</span> Marketplace
            melaporkan{" "}
            <span className="font-semibold tabular-nums">
              {source.totalReviewsReported!.toLocaleString("id-ID")}
            </span>{" "}
            review, namun scraper hanya berhasil mengambil{" "}
            <span className="font-semibold tabular-nums">
              {source.reviewCount.toLocaleString("id-ID")}
            </span>{" "}
            ({Math.round((source.reviewCount / source.totalReviewsReported!) * 100)}
            %). Interpretasikan insight sebagai sampel, bukan populasi penuh.
          </p>
        </div>
      ) : null}

      <DataSourceProvenancePanel entries={source.dataProvenance} />

      {!source.summary ? (
        <div className={cn(hub.panel, "text-center")}>
          <p className="text-muted-foreground text-sm">
            Analisis sedang berjalan atau belum tersedia. Halaman akan
            diperbarui otomatis.
          </p>
        </div>
      ) : (
        <Tabs defaultValue="ringkasan" className="gap-0">
          <div className={cn(hub.stickyToolbar, "pb-0")}>
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
                  <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
                    {source.reviewCount}
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
            {source.summary.actionPlan ? (
              <ResearchHubSection
                title="Rencana Aksi"
                description="Langkah prioritas dari analisis sentimen & keluhan."
                delayMs={0}
              >
                <ActionPlanPanel
                  plan={source.summary.actionPlan}
                  title="Rencana Aksi (AI)"
                  emptyHint="Rencana aksi belum tersedia. Jalankan analisis ulang untuk menghasilkan rekomendasi preskriptif."
                />
              </ResearchHubSection>
            ) : null}

            <ResearchHubSection
              title="Distribusi Sentimen"
              description="Proporsi review positif, netral, dan negatif."
              delayMs={50}
            >
              <div className={hub.panel}>
                <ReviewSentimentChart
                  positivePct={source.summary.positivePct}
                  neutralPct={source.summary.neutralPct}
                  negativePct={source.summary.negativePct}
                />
              </div>
            </ResearchHubSection>

            <ResearchHubSection
              title="Gap Opportunity"
              description="Peluang produk dari celah yang muncul di review kompetitor."
              delayMs={100}
            >
              <div className={hub.panel}>
                <p className="text-sm leading-relaxed">
                  {source.summary.gapOpportunity ??
                    "Insight gap opportunity belum tersedia."}
                </p>
              </div>
            </ResearchHubSection>
          </TabsContent>

          <TabsContent value="tema" className={tabContentClass}>
            <div className="grid gap-4 lg:grid-cols-2">
              <ResearchHubSection
                title="Top Complaints"
                description="Tema keluhan yang paling sering muncul."
              >
                <div className={hub.panel}>
                  <ThemeRankList
                    items={source.summary.topComplaints}
                    emptyLabel="Belum ada keluhan terkategorisasi."
                  />
                </div>
              </ResearchHubSection>

              <ResearchHubSection
                title="Top Praises"
                description="Tema pujian yang paling sering disebut."
                delayMs={50}
              >
                <div className={hub.panel}>
                  <ThemeRankList
                    items={source.summary.topPraises}
                    emptyLabel="Belum ada pujian terkategorisasi."
                  />
                </div>
              </ResearchHubSection>
            </div>

            <ResearchHubSection
              title="Keyword Cloud"
              description="Kata kunci dominan dari teks review."
              delayMs={100}
            >
              <div className={hub.panel}>
                <KeywordCloud keywords={source.summary.keywordCloud} />
              </div>
            </ResearchHubSection>

            <ResearchHubSection
              title="Keparahan Keluhan"
              description="Severity rata-rata per tema keluhan."
              delayMs={150}
            >
              <div className={hub.panel}>
                <ComplaintSeverityChart
                  items={source.summary.severityByTheme}
                />
              </div>
            </ResearchHubSection>
          </TabsContent>

          <TabsContent value="demografi" className={tabContentClass}>
            <ResearchHubSection
              title="Demografi Terinferensi"
              description="Estimasi dari teks review — perlakukan sebagai sinyal, bukan data presisi."
            >
              <div className={hub.panel}>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  <DemographicDonut
                    title="Skin type"
                    items={source.summary.demographics.skinTypes}
                  />
                  <DemographicDonut
                    title="Kelompok umur"
                    items={source.summary.demographics.ageBands}
                  />
                  <DemographicDonut
                    title="Gender"
                    items={source.summary.demographics.genders}
                  />
                </div>
              </div>
            </ResearchHubSection>

            <ResearchHubSection
              title="Review Timeline"
              description="Tren sentimen per bulan dari review yang dianalisis. Review tanpa tanggal tidak masuk timeline (tidak diberi tanggal 'sekarang')."
              delayMs={50}
            >
              <div className={hub.panel}>
                <ReviewTimelineChart data={source.summary.timelineBuckets} />
                {(() => {
                  const dated = source.summary.timelineBuckets.reduce(
                    (acc, b) => acc + b.positive + b.neutral + b.negative,
                    0,
                  );
                  const undated = Math.max(0, source.reviewCount - dated);
                  return undated > 0 ? (
                    <p className="text-muted-foreground mt-2 text-[11px]">
                      {undated.toLocaleString("id-ID")} review tanpa tanggal
                      valid tidak ditampilkan di timeline (tetap dihitung di
                      sentimen &amp; tema).
                    </p>
                  ) : null;
                })()}
              </div>
            </ResearchHubSection>
          </TabsContent>

          <TabsContent value="review" className={tabContentClass}>
            <ResearchHubSection
              title="Raw Reviews"
              description="Data mentah hasil scrape — cari, filter, dan export CSV."
            >
              <ReviewRawDataPanel
                sourceId={source.id}
                productName={source.productName}
                productUrl={source.productUrl}
                reviewCount={source.reviewCount}
                fetchPage={getReviewIntelRawReviews}
                exportCsv={exportReviewIntelRawReviewsCsv}
                bare
              />
            </ResearchHubSection>
          </TabsContent>

          {compareOptions.length > 0 ? (
            <TabsContent value="bandingkan" className={tabContentClass}>
              <ResearchHubSection
                title="Cross-Product Compare"
                description="Bandingkan distribusi sentimen dengan produk lain (maks. 4)."
              >
                <div className={hub.panel}>
                  <div className="mb-4 flex flex-col gap-2">
                    {compareOptions.map((opt) => (
                      <label
                        key={opt.id}
                        className={cn(
                          hub.nestedPanel,
                          "flex cursor-pointer items-center gap-2 text-sm transition-colors duration-150 motion-reduce:transition-none hover:bg-muted/30",
                        )}
                      >
                        <Checkbox
                          checked={selectedCompare.includes(opt.id)}
                          onCheckedChange={() => toggleCompare(opt.id)}
                        />
                        <span>
                          {opt.productName}{" "}
                          <span className="text-muted-foreground">
                            ({opt.competitorBrand})
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <CrossCompareChart data={compareChartData} />
                </div>
              </ResearchHubSection>
            </TabsContent>
          ) : null}
        </Tabs>
      )}

      {source.reviewCount > 0 && !source.summary ? (
        <ResearchHubSection
          title="Raw Reviews"
          description="Review sudah ter-scrape — analisis AI masih berjalan."
        >
          <ReviewRawDataPanel
            sourceId={source.id}
            productName={source.productName}
            productUrl={source.productUrl}
            reviewCount={source.reviewCount}
            fetchPage={getReviewIntelRawReviews}
            exportCsv={exportReviewIntelRawReviewsCsv}
            bare
          />
        </ResearchHubSection>
      ) : null}
    </div>
  );
}

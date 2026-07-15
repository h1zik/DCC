"use client";

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
  exportBrandReviewRawReviewsCsv,
  getBrandReviewRawReviews,
  rescrapeBrandReviewIntelSource,
} from "@/actions/brand-review-intelligence";
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
import { BrandHubDetailPage } from "@/components/brand-hub/brand-hub-list-page";
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
import { lab, LabSection } from "@/components/lab/lab-primitives";
import {
  brandHubHref,
  useBrandHubBrandId,
} from "@/hooks/use-brand-hub-brand-id";
import { cn } from "@/lib/utils";
import { useBrandReviewIntelPolling } from "../use-brand-review-intel-polling";
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

/** Segmen distribusi sentimen untuk stacked bar papan hero. */
const SENTIMENT_SEGMENTS = [
  { key: "positive", label: "Positif", dot: "bg-emerald-500" },
  { key: "neutral", label: "Netral", dot: "bg-slate-400 dark:bg-slate-500" },
  { key: "negative", label: "Negatif", dot: "bg-rose-500" },
] as const;

/** Pill status tinted untuk header detail. */
function StatusPill({ status }: { status: string }) {
  const running = status === "SCRAPING" || status === "ANALYZING";
  const label =
    SOURCE_STATUS_LABELS[status as keyof typeof SOURCE_STATUS_LABELS] ??
    status;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        status === "READY" &&
          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        status === "FAILED" &&
          "bg-rose-500/15 text-rose-700 dark:text-rose-300",
        running && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        status === "PENDING" && "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "READY" && "bg-emerald-500",
          status === "FAILED" && "bg-rose-500",
          running && "bg-amber-500 animate-pulse motion-reduce:animate-none",
          status === "PENDING" && "bg-muted-foreground/50",
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-4 duration-200 motion-reduce:animate-none pt-4";

export function BrandReviewDetailClient({
  source,
  compareOptions,
  rooms,
}: {
  source: ReviewDetailData;
  compareOptions: CompareOption[];
  rooms: RoomOption[];
}) {
  const router = useRouter();
  const brandId = useBrandHubBrandId();
  const [pending, startTransition] = useTransition();
  const inProgress =
    source.status === "SCRAPING" || source.status === "ANALYZING";
  useBrandReviewIntelPolling(inProgress);
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

  const sentimentValues = source.summary
    ? {
        positive: source.summary.positivePct,
        neutral: source.summary.neutralPct,
        negative: source.summary.negativePct,
      }
    : null;
  const sentimentTotal = sentimentValues
    ? Math.max(
        sentimentValues.positive +
          sentimentValues.neutral +
          sentimentValues.negative,
        1,
      )
    : 1;

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
        await rescrapeBrandReviewIntelSource(source.id);
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
    <BrandHubDetailPage
      icon={Star}
      backHref={brandHubHref("/brand-hub/review-intelligence", brandId)}
      title={source.productName}
      description={`${source.competitorBrand} · ${getReviewPlatformLabel(source.platformKey)} · ${source.reviewCount.toLocaleString("id-ID")} review · diperbarui ${formatRelativeTime(
        source.lastAnalyzedAt ? new Date(source.lastAnalyzedAt) : null,
      )}`}
      right={
        <>
          <StatusPill status={source.status} />
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
                      items={rooms.map((r) => ({
                        value: r.id,
                        label: r.brandName
                          ? `${r.name} · ${r.brandName}`
                          : r.name,
                      }))}
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
                            actionErrorMessage(
                              err,
                              "Gagal memproses permintaan.",
                            ),
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
    >
      {inProgress ? (
        <div className={lab.entrance}>
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
            lab.nestedPanel,
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
        <div className={cn(lab.panel, "text-center")}>
          <p className="text-muted-foreground text-sm">
            Analisis sedang berjalan atau belum tersedia. Halaman akan
            diperbarui otomatis.
          </p>
        </div>
      ) : (
        <>
          {/* Papan hero bento */}
          <div
            className={cn(
              lab.entrance,
              "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4",
            )}
          >
            {/* Total review — hero pink */}
            <div className="bento-tile col-span-2 row-span-2 border-transparent bg-pink-600 shadow-md shadow-pink-600/20 lg:col-span-1 dark:bg-pink-500">
              <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
                Review dianalisis
              </span>
              <span className="bento-value text-5xl text-white dark:text-pink-950">
                {source.reviewCount.toLocaleString("id-ID")}
              </span>
              <span className="text-[11px] font-medium leading-snug text-pink-100/90 dark:text-pink-900/80">
                {isPartial
                  ? `sampel dari ${source.totalReviewsReported!.toLocaleString("id-ID")} review di ${getReviewPlatformLabel(source.platformKey)}`
                  : `dari ${getReviewPlatformLabel(source.platformKey)} · ${source.competitorBrand}`}
              </span>
            </div>

            {/* Distribusi sentimen — stacked bar */}
            <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
              <div className="flex items-center justify-between">
                <span className="bento-label">Distribusi sentimen</span>
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {source.reviewCount.toLocaleString("id-ID")} review
                </span>
              </div>
              <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
                {SENTIMENT_SEGMENTS.map((s) => {
                  const value = sentimentValues?.[s.key] ?? 0;
                  if (value <= 0) return null;
                  return (
                    <div
                      key={s.key}
                      className={s.dot}
                      style={{ width: `${(value / sentimentTotal) * 100}%` }}
                      title={`${s.label}: ${value.toFixed(0)}%`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-col gap-1.5">
                {SENTIMENT_SEGMENTS.map((s) => {
                  const value = sentimentValues?.[s.key] ?? 0;
                  return (
                    <div key={s.key} className="flex items-center gap-2 text-xs">
                      <span
                        className={cn("size-2 shrink-0 rounded-full", s.dot)}
                        aria-hidden
                      />
                      <span className="text-muted-foreground flex-1">
                        {s.label}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {value.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tema keluhan — rose pastel */}
            <div className="bento-tile border-transparent bg-[#fbdcd7] dark:bg-rose-400/10">
              <span className="text-[11.5px] font-semibold text-rose-800/70 dark:text-rose-200/60">
                Tema keluhan
              </span>
              <span className="bento-value text-rose-900 dark:text-rose-300">
                {source.summary.topComplaints.length}
              </span>
              <span className="line-clamp-1 text-[11px] font-medium capitalize text-rose-800/60 dark:text-rose-200/50">
                {source.summary.topComplaints[0]?.theme ?? "tidak ada keluhan"}
              </span>
            </div>

            {/* Tema pujian — pink pastel */}
            <div className="bento-tile border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
              <span className="text-[11.5px] font-semibold text-pink-700/70 dark:text-pink-300/70">
                Tema pujian
              </span>
              <span className="bento-value text-emerald-600 dark:text-emerald-400">
                {source.summary.topPraises.length}
              </span>
              <span className="line-clamp-1 text-[11px] font-medium capitalize text-pink-700/70 dark:text-pink-300/70">
                {source.summary.topPraises[0]?.theme ?? "belum terdeteksi"}
              </span>
            </div>
          </div>

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
                <LabSection
                  title="Rencana Aksi"
                  description="Langkah prioritas dari analisis sentimen & keluhan."
                  delayMs={0}
                >
                  <ActionPlanPanel
                    plan={source.summary.actionPlan}
                    title="Rencana Aksi (AI)"
                    emptyHint="Rencana aksi belum tersedia. Jalankan analisis ulang untuk menghasilkan rekomendasi preskriptif."
                  />
                </LabSection>
              ) : null}

              <div className="grid gap-3 lg:grid-cols-2">
                <section className="bento-tile justify-start gap-3">
                  <div>
                    <p className="bento-label">Gap opportunity</p>
                    <p className="text-muted-foreground text-xs">
                      Peluang produk dari celah di review kompetitor.
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed">
                    {source.summary.gapOpportunity ??
                      "Insight gap opportunity belum tersedia."}
                  </p>
                </section>

                <section className="bento-tile justify-start gap-3">
                  <div>
                    <p className="bento-label">Proporsi sentimen</p>
                    <p className="text-muted-foreground text-xs">
                      Review positif, netral, dan negatif.
                    </p>
                  </div>
                  <ReviewSentimentChart
                    positivePct={source.summary.positivePct}
                    neutralPct={source.summary.neutralPct}
                    negativePct={source.summary.negativePct}
                  />
                </section>
              </div>
            </TabsContent>

            <TabsContent value="tema" className={tabContentClass}>
              <div className="grid gap-3 lg:grid-cols-2">
                <section className="bento-tile justify-start gap-3">
                  <div>
                    <p className="bento-label">Top complaints</p>
                    <p className="text-muted-foreground text-xs">
                      Tema keluhan yang paling sering muncul.
                    </p>
                  </div>
                  <ThemeRankList
                    items={source.summary.topComplaints}
                    emptyLabel="Belum ada keluhan terkategorisasi."
                  />
                </section>

                <section className="bento-tile justify-start gap-3">
                  <div>
                    <p className="bento-label">Top praises</p>
                    <p className="text-muted-foreground text-xs">
                      Tema pujian yang paling sering disebut.
                    </p>
                  </div>
                  <ThemeRankList
                    items={source.summary.topPraises}
                    emptyLabel="Belum ada pujian terkategorisasi."
                  />
                </section>
              </div>

              <section className="bento-tile justify-start gap-3">
                <div>
                  <p className="bento-label">Keyword cloud</p>
                  <p className="text-muted-foreground text-xs">
                    Kata kunci dominan dari teks review.
                  </p>
                </div>
                <KeywordCloud keywords={source.summary.keywordCloud} />
              </section>

              <section className="bento-tile justify-start gap-3">
                <div>
                  <p className="bento-label">Keparahan keluhan</p>
                  <p className="text-muted-foreground text-xs">
                    Severity rata-rata per tema keluhan.
                  </p>
                </div>
                <ComplaintSeverityChart items={source.summary.severityByTheme} />
              </section>
            </TabsContent>

            <TabsContent value="demografi" className={tabContentClass}>
              <section className="bento-tile justify-start gap-3">
                <div>
                  <p className="bento-label">Demografi terinferensi</p>
                  <p className="text-muted-foreground text-xs">
                    Estimasi dari teks review — perlakukan sebagai sinyal, bukan
                    data presisi.
                  </p>
                </div>
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
              </section>

              <section className="bento-tile justify-start gap-3">
                <div>
                  <p className="bento-label">Review timeline</p>
                  <p className="text-muted-foreground text-xs">
                    Tren sentimen per bulan. Review tanpa tanggal tidak masuk
                    timeline (tidak diberi tanggal &ldquo;sekarang&rdquo;).
                  </p>
                </div>
                <ReviewTimelineChart data={source.summary.timelineBuckets} />
                {(() => {
                  const dated = source.summary.timelineBuckets.reduce(
                    (acc, b) => acc + b.positive + b.neutral + b.negative,
                    0,
                  );
                  const undated = Math.max(0, source.reviewCount - dated);
                  return undated > 0 ? (
                    <p className="text-muted-foreground text-[11px]">
                      {undated.toLocaleString("id-ID")} review tanpa tanggal
                      valid tidak ditampilkan di timeline (tetap dihitung di
                      sentimen &amp; tema).
                    </p>
                  ) : null;
                })()}
              </section>
            </TabsContent>

            <TabsContent value="review" className={tabContentClass}>
              <ReviewRawDataPanel
                sourceId={source.id}
                productName={source.productName}
                reviewCount={source.reviewCount}
                fetchPage={getBrandReviewRawReviews}
                exportCsv={exportBrandReviewRawReviewsCsv}
                bare
              />
            </TabsContent>

            {compareOptions.length > 0 ? (
              <TabsContent value="bandingkan" className={tabContentClass}>
                <section className="bento-tile justify-start gap-3">
                  <div>
                    <p className="bento-label">Cross-product compare</p>
                    <p className="text-muted-foreground text-xs">
                      Bandingkan distribusi sentimen dengan produk lain (maks.
                      4).
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {compareOptions.map((opt) => (
                      <label
                        key={opt.id}
                        className="bg-muted/40 hover:bg-muted/70 flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors duration-150 motion-reduce:transition-none"
                      >
                        <Checkbox
                          checked={selectedCompare.includes(opt.id)}
                          onCheckedChange={() => toggleCompare(opt.id)}
                        />
                        <span className="min-w-0 truncate">
                          {opt.productName}{" "}
                          <span className="text-muted-foreground">
                            ({opt.competitorBrand})
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <CrossCompareChart data={compareChartData} />
                </section>
              </TabsContent>
            ) : null}
          </Tabs>
        </>
      )}

      {source.reviewCount > 0 && !source.summary ? (
        <LabSection
          title="Raw Reviews"
          description="Review sudah ter-scrape — analisis AI masih berjalan."
        >
          <ReviewRawDataPanel
            sourceId={source.id}
            productName={source.productName}
            reviewCount={source.reviewCount}
            fetchPage={getBrandReviewRawReviews}
            exportCsv={exportBrandReviewRawReviewsCsv}
            bare
          />
        </LabSection>
      ) : null}
    </BrandHubDetailPage>
  );
}

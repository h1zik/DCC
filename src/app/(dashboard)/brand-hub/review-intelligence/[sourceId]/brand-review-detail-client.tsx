"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { createProductBriefFromInsight } from "@/actions/research-brief";
import {
  exportBrandReviewRawReviewsCsv,
  getBrandReviewRawReviews,
  rescrapeBrandReviewIntelSource,
} from "@/actions/brand-review-intelligence";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
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
import { getReviewPlatformLabel } from "@/lib/review-platforms/platforms";
import {
  SOURCE_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import { cn } from "@/lib/utils";
import { useBrandReviewIntelPolling } from "../use-brand-review-intel-polling";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";

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

  return (
    <div className="flex flex-col gap-6">
      <ResearchModelBadgeGroup meta={source.aiMeta} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            <Link href="/brand-hub/review-intelligence">
              <ArrowLeft className="size-3.5" aria-hidden />
              Kembali
            </Link>
          }
        />
        {source.platformKey !== "csv" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
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
            })
          }
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Scrape Ulang
        </Button>
        ) : null}
      </div>

      <header className="border-border bg-card rounded-2xl border p-5 shadow-sm">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Review Intelligence
        </p>
        <h1 className="text-foreground mt-1 text-2xl font-semibold tracking-tight">
          {source.productName}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {source.competitorBrand} · {getReviewPlatformLabel(source.platformKey)} ·{" "}
          {source.reviewCount.toLocaleString("id-ID")} review dianalisa · Update:{" "}
          {formatRelativeTime(
            source.lastAnalyzedAt ? new Date(source.lastAnalyzedAt) : null,
          )}
        </p>
        <span
          className={cn(
            "mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
            source.status === "READY"
              ? "bg-emerald-500/15 text-emerald-700"
              : "bg-muted text-muted-foreground",
          )}
        >
          {SOURCE_STATUS_LABELS[source.status as keyof typeof SOURCE_STATUS_LABELS] ??
            source.status}
        </span>

        {inProgress ? (
          <JobProgressBar
            className="mt-3"
            title={source.status === "SCRAPING" ? "Scraping review" : "Menganalisis review"}
            percent={statusToProgress(source.status).percent}
            stepLabel={`${statusToProgress(source.status).label} — halaman refresh otomatis, kamu boleh lanjut browsing.`}
          />
        ) : null}

        {source.totalReviewsReported != null &&
        source.totalReviewsReported > source.reviewCount ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-xs leading-relaxed">
              <span className="font-semibold">Data parsial.</span> Marketplace
              melaporkan{" "}
              <span className="font-semibold tabular-nums">
                {source.totalReviewsReported.toLocaleString("id-ID")}
              </span>{" "}
              review, namun scraper hanya berhasil mengambil{" "}
              <span className="font-semibold tabular-nums">
                {source.reviewCount.toLocaleString("id-ID")}
              </span>{" "}
              ({Math.round((source.reviewCount / source.totalReviewsReported) * 100)}
              %). Ini batas akses scraper — interpretasikan insight sebagai
              sampel, bukan populasi penuh.
            </p>
          </div>
        ) : null}
      </header>

      <ReviewRawDataPanel
        sourceId={source.id}
        productName={source.productName}
        reviewCount={source.reviewCount}
        fetchPage={getBrandReviewRawReviews}
        exportCsv={exportBrandReviewRawReviewsCsv}
      />

      {!source.summary ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center text-sm">
          Analisis sedang berjalan atau belum tersedia. Refresh halaman beberapa
          saat lagi.
        </div>
      ) : (
        <>
          <ActionPlanPanel
            plan={source.summary.actionPlan}
            title="Rencana Aksi (AI)"
            emptyHint="Rencana aksi belum tersedia. Jalankan analisis ulang untuk menghasilkan rekomendasi preskriptif."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Sentiment">
              <ReviewSentimentChart
                positivePct={source.summary.positivePct}
                neutralPct={source.summary.neutralPct}
                negativePct={source.summary.negativePct}
              />
            </Panel>
            <Panel title="Top Complaints">
              <ThemeRankList
                items={source.summary.topComplaints}
                emptyLabel="Belum ada keluhan terkategorisasi."
              />
            </Panel>
            <Panel title="Top Praises">
              <ThemeRankList
                items={source.summary.topPraises}
                emptyLabel="Belum ada pujian terkategorisasi."
              />
            </Panel>
            <Panel title="Keyword Cloud">
              <KeywordCloud keywords={source.summary.keywordCloud} />
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Keparahan Keluhan (severity)">
              <ComplaintSeverityChart items={source.summary.severityByTheme} />
            </Panel>
            <Panel title="Demografi Terinferensi (AI)">
              <p className="text-muted-foreground mb-3 text-xs">
                Estimasi dari teks review — perlakukan sebagai sinyal, bukan
                data demografis presisi.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <DemographicDonut
                  title="Skin type"
                  items={source.summary.demographics.skinTypes}
                />
                <DemographicDonut
                  title="Kelompok umur"
                  items={source.summary.demographics.ageBands}
                />
              </div>
            </Panel>
          </div>

          <Panel title="Review Timeline">
            <ReviewTimelineChart data={source.summary.timelineBuckets} />
          </Panel>

          <Panel title="Gap Opportunity (AI)">
            <p className="text-foreground text-sm leading-relaxed">
              {source.summary.gapOpportunity ??
                "Insight gap opportunity belum tersedia."}
            </p>
            <div className="mt-4">
              <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
                <DialogTrigger
                  render={
                    <Button size="sm">
                      <FileText className="size-3.5" aria-hidden />
                      Buat Brief →
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
                            toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
                          }
                        })
                      }
                    >
                      Buat di Pipeline
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </Panel>

          {compareOptions.length > 0 ? (
            <Panel title="Cross-Product Compare">
              <div className="mb-4 flex flex-col gap-2">
                {compareOptions.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
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
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card rounded-xl border p-4 shadow-sm">
      <h2 className="text-foreground mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

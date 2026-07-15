"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CalendarRange,
  Copy,
  FileText,
  Grid3x3,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { KeywordIntelStatus, ResearchMarketplace } from "@prisma/client";
import { toast } from "sonner";
import { createProductBriefFromKeyword } from "@/actions/research-brief";
import { refreshKeywordIntelQuery } from "@/actions/research-keyword-intel";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import { CopyKeywordsPanel } from "@/components/research-hub/copy-keywords-panel";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { KeywordEvidenceTable } from "@/components/research-hub/keyword-evidence-table";
import { KeywordGapList } from "@/components/research-hub/keyword-gap-list";
import { KeywordMatrixTable } from "@/components/research-hub/keyword-matrix-table";
import { KeywordOpportunityChart } from "@/components/research-hub/keyword-opportunity-chart";
import { KeywordQualityBanner } from "@/components/research-hub/keyword-quality-banner";
import { DataSourceProvenancePanel } from "@/components/research-hub/data-source-provenance-panel";
import { NamingSuggestionsCard } from "@/components/research-hub/naming-suggestions-card";
import {
  SeasonalKeywordChart,
  type SeasonalMonth,
} from "@/components/research-hub/seasonal-keyword-chart";
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
import {
  KEYWORD_INTEL_STATUS_LABELS,
  MARKETPLACE_LABELS,
} from "@/lib/research/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import type {
  GapKeywordRow,
  KeywordMatrixRow,
  KeywordSignalStats,
  SeasonalCurve,
} from "@/lib/research/keyword-intel/keyword-signal-types";
import { lab } from "@/components/lab/lab-primitives";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import type { DataProvenanceEntry } from "@/lib/research/scrape-data-provider";

export type KeywordDetailData = {
  id: string;
  category: string;
  seedKeyword: string | null;
  marketplace: ResearchMarketplace | null;
  status: KeywordIntelStatus;
  dataNotice: string | null;
  signalStats: KeywordSignalStats | null;
  dataProvenance: DataProvenanceEntry[];
  volumeSource: string | null;
  aiSummary: string | null;
  hasGoogleVolume: boolean;
  matrix: KeywordMatrixRow[];
  gaps: GapKeywordRow[];
  namingSuggestions: string[];
  copyKeywords: {
    listingTitle?: string[];
    listingDescription?: string[];
    socialMedia?: string[];
  };
  seasonalCalendar: SeasonalMonth[];
  seasonalCurves: SeasonalCurve[];
  clusters: { name: string; keywords: string[] }[];
  actionPlan: unknown;
  aiMeta: ResearchAiMetaView | null;
  rooms: {
    id: string;
    name: string;
    brandId: string | null;
    brandName: string | null;
  }[];
};

function isInProgress(status: KeywordIntelStatus) {
  return (
    status === "COLLECTING" ||
    status === "ANALYZING" ||
    status === "PENDING"
  );
}

function StatusPill({ status }: { status: KeywordIntelStatus }) {
  const tone =
    status === "READY"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : status === "FAILED"
        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
        : isInProgress(status)
          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
          : "bg-muted text-muted-foreground";
  const dot =
    status === "READY"
      ? "bg-emerald-500"
      : status === "FAILED"
        ? "bg-rose-500"
        : isInProgress(status)
          ? "bg-amber-500"
          : "bg-muted-foreground/50";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        tone,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          dot,
          isInProgress(status) && "animate-pulse",
        )}
      />
      {KEYWORD_INTEL_STATUS_LABELS[status]}
    </span>
  );
}

/** Segmen distribusi sinyal per sumber untuk stacked bar hero. */
const SIGNAL_SEGMENTS = [
  { key: "shopee", label: "Shopee", dot: "bg-violet-500" },
  { key: "tokopedia", label: "Tokopedia", dot: "bg-teal-500" },
  { key: "googleTrends", label: "Google Trends", dot: "bg-amber-400" },
  { key: "dataforseo", label: "Google volume", dot: "bg-sky-500" },
  { key: "shopeeSearch", label: "Shopee sample", dot: "bg-rose-400" },
  { key: "internal", label: "Sinyal internal", dot: "bg-emerald-500" },
] as const;

function signalCounts(stats: KeywordSignalStats) {
  const internal =
    (stats.internal?.competitor ?? 0) +
    (stats.internal?.reviewIntel ?? 0) +
    (stats.internal?.socialListening ?? 0);
  return {
    shopee: stats.external?.shopee ?? 0,
    tokopedia: stats.external?.tokopedia ?? 0,
    googleTrends: stats.external?.googleTrends ?? 0,
    dataforseo: stats.external?.dataforseo ?? 0,
    shopeeSearch: stats.external?.shopeeSearch ?? 0,
    internal,
  } as Record<(typeof SIGNAL_SEGMENTS)[number]["key"], number>;
}

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-6 duration-200 motion-reduce:animate-none pt-4";

export function KeywordDetailClient({ data }: { data: KeywordDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [briefOpen, setBriefOpen] = useState(false);
  const [roomId, setRoomId] = useState(data.rooms[0]?.id ?? "");
  const [projectName, setProjectName] = useState(`Keyword: ${data.category}`);

  const selectedRoom = data.rooms.find((r) => r.id === roomId);
  const canBrief = data.status === "READY";

  const roomItems = useMemo(
    (): SelectItemDef[] =>
      data.rooms.map((r) => ({
        value: r.id,
        label: r.brandName ? `${r.name} — ${r.brandName}` : r.name,
      })),
    [data.rooms],
  );

  const isProcessing = isInProgress(data.status);

  useEffect(() => {
    if (!isProcessing) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [isProcessing, router]);

  const volumeByKeyword = data.matrix.reduce<Record<string, number>>(
    (acc, row) => {
      if (typeof row.volume === "number" && row.volume > 0) {
        acc[row.keyword.trim().toLowerCase()] = row.volume;
      }
      return acc;
    },
    {},
  );

  const opportunityPoints = data.matrix
    .filter((m) => (m.koiScore ?? 0) > 0)
    .slice(0, 40)
    .map((m) => ({
      keyword: m.keyword,
      volume: m.volume,
      listingSampleCount: m.listingSampleCount ?? 0,
      koiScore: m.koiScore ?? 0,
    }));

  const highConfidenceCount = useMemo(
    () => data.matrix.filter((m) => m.confidence === "HIGH").length,
    [data.matrix],
  );

  const counts = data.signalStats ? signalCounts(data.signalStats) : null;
  const signalTotal = data.signalStats?.total ?? 0;
  const signalDenom =
    counts != null
      ? Math.max(
          1,
          SIGNAL_SEGMENTS.reduce((sum, s) => sum + counts[s.key], 0),
        )
      : 1;

  const descriptionParts = [
    data.seedKeyword ? `Seed: ${data.seedKeyword}` : null,
    data.marketplace
      ? MARKETPLACE_LABELS[data.marketplace]
      : "Semua marketplace",
    data.volumeSource ?? null,
  ].filter(Boolean);

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshKeywordIntelQuery(data.id);
        toast.success("Refresh dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
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
        const result = await createProductBriefFromKeyword({
          queryId: data.id,
          roomId,
          brandId: selectedRoom.brandId!,
          projectName,
        });
        toast.success("Brief dibuat.");
        setBriefOpen(false);
        router.push(`/projects/${result.projectId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
      }
    });
  }

  return (
    <ResearchHubDetailPage
      icon={Search}
      backHref="/research-hub/keyword-intel"
      title={data.category}
      description={descriptionParts.join(" · ")}
      right={
        <>
          <ResearchModelBadgeGroup meta={data.aiMeta} />
          <StatusPill status={data.status} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={pending || isProcessing}
          >
            <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
            Refresh
          </Button>
          {data.status === "READY" ? (
            <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
              <DialogTrigger
                render={
                  <Button size="sm" disabled={!canBrief}>
                    <FileText className="mr-1.5 size-3.5" aria-hidden />
                    Buat Brief
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    Buat Product Brief dari Keyword Intel
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid gap-1.5">
                    <Label>Room / Brand</Label>
                    <Select
                      value={roomId}
                      items={roomItems}
                      onValueChange={(v) => setRoomId(v ?? "")}
                    >
                      <SelectTrigger>
                        {selectedRoom
                          ? `${selectedRoom.name}${selectedRoom.brandName ? ` (${selectedRoom.brandName})` : ""}`
                          : "Pilih room"}
                      </SelectTrigger>
                      <SelectContent>
                        {data.rooms.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                            {r.brandName ? ` — ${r.brandName}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Nama proyek</Label>
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleBrief} disabled={pending || !canBrief}>
                    Buat Brief
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </>
      }
    >
      <KeywordQualityBanner dataNotice={data.dataNotice} />

      <DataSourceProvenancePanel entries={data.dataProvenance} />

      {isProcessing ? (
        <div className={lab.entrance}>
          <JobProgressBar
            title="Mengumpulkan & menganalisis keyword"
            percent={45}
            stepLabel="Pipeline sinyal marketplace, volume, dan AI berjalan di background — halaman refresh otomatis."
          />
        </div>
      ) : (
        <>
          {/* Papan hero bento */}
          {data.matrix.length > 0 || signalTotal > 0 ? (
            <div
              className={cn(
                lab.entrance,
                "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4",
              )}
            >
              {/* Keyword — tile hero violet */}
              <div className="bento-tile col-span-2 row-span-2 border-transparent bg-violet-600 shadow-md shadow-violet-600/20 lg:col-span-1 dark:bg-violet-500">
                <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
                  Keyword teranalisis
                </span>
                <span className="bento-value text-5xl text-white dark:text-violet-950">
                  {data.matrix.length.toLocaleString("id-ID")}
                </span>
                <span className="text-xs font-medium leading-snug text-violet-100/90 dark:text-violet-900/80">
                  {highConfidenceCount > 0
                    ? `${highConfidenceCount} keyword confidence tinggi`
                    : "dari sinyal multi-sumber terverifikasi"}
                </span>
              </div>

              {/* Distribusi sinyal — stacked bar */}
              <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
                <div className="flex items-center justify-between">
                  <span className="bento-label">Sinyal per sumber</span>
                  <span className="text-muted-foreground text-[11px] tabular-nums">
                    {signalTotal.toLocaleString("id-ID")} sinyal
                  </span>
                </div>
                {counts ? (
                  <>
                    <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
                      {SIGNAL_SEGMENTS.map((s) => {
                        const count = counts[s.key];
                        if (count === 0) return null;
                        return (
                          <div
                            key={s.key}
                            className={s.dot}
                            style={{
                              width: `${(count / signalDenom) * 100}%`,
                            }}
                            title={`${s.label}: ${count}`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {SIGNAL_SEGMENTS.filter((s) => counts[s.key] > 0).map(
                        (s) => (
                          <div
                            key={s.key}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span
                              className={cn(
                                "size-2 shrink-0 rounded-full",
                                s.dot,
                              )}
                              aria-hidden
                            />
                            <span className="text-muted-foreground flex-1">
                              {s.label}
                            </span>
                            <span className="font-semibold tabular-nums">
                              {counts[s.key]}
                            </span>
                            <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
                              {Math.round((counts[s.key] / signalDenom) * 100)}
                              %
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground m-auto text-sm">
                    Belum ada statistik sinyal.
                  </p>
                )}
              </div>

              {/* Gap — amber pastel */}
              <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
                <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
                  Keyword gap
                </span>
                <span className="bento-value text-amber-900 dark:text-amber-300">
                  {data.gaps.length.toLocaleString("id-ID")}
                </span>
                <span className="text-[11px] font-medium text-amber-800/70 dark:text-amber-300/70">
                  peluang belum tergarap
                </span>
              </div>

              {/* Naming — lavender pastel */}
              <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
                <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
                  Saran naming
                </span>
                <span className="bento-value text-violet-900 dark:text-violet-300">
                  {data.namingSuggestions.length > 0
                    ? data.namingSuggestions.length.toLocaleString("id-ID")
                    : "—"}
                </span>
                <span className="text-[11px] font-medium text-violet-700/70 dark:text-violet-300/70">
                  dari pola keyword
                </span>
              </div>

              {/* Cluster */}
              <div className="bento-tile">
                <span className="bento-label">Cluster tema</span>
                <span className="bento-value">
                  {data.clusters.length > 0
                    ? data.clusters.length.toLocaleString("id-ID")
                    : "—"}
                </span>
              </div>

              {/* Volume source */}
              <div className="bento-tile">
                <span className="bento-label">Volume Google</span>
                <span className="bento-value text-2xl">
                  {data.hasGoogleVolume ? "Aktif" : "Estimasi"}
                </span>
                <span className="text-muted-foreground text-[11px] font-medium">
                  {data.hasGoogleVolume
                    ? "volume pencarian terukur"
                    : "proxy dari rank/listing"}
                </span>
              </div>
            </div>
          ) : null}

          <Tabs defaultValue="ringkasan" className="gap-0">
            <div className={cn(lab.stickyToolbar, "pb-0")}>
              <TabsList
                variant="line"
                className="h-9 w-full justify-start gap-4"
              >
                <TabsTrigger value="ringkasan" className="px-1">
                  <Sparkles className="size-3.5" aria-hidden />
                  Ringkasan
                </TabsTrigger>
                <TabsTrigger value="matrix" className="px-1">
                  <Grid3x3 className="size-3.5" aria-hidden />
                  Matrix
                  {data.matrix.length > 0 ? (
                    <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
                      {data.matrix.length}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="gap" className="px-1">
                  <Copy className="size-3.5" aria-hidden />
                  Gap & Copy
                  {data.gaps.length > 0 ? (
                    <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
                      {data.gaps.length}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="musim" className="px-1">
                  <CalendarRange className="size-3.5" aria-hidden />
                  Musim
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="ringkasan" className={tabContentClass}>
              {data.aiSummary ? (
                <div className="bento-tile justify-start gap-3">
                  <span className="bento-label">AI summary</span>
                  <p className="text-sm leading-relaxed">{data.aiSummary}</p>
                </div>
              ) : null}

              {data.actionPlan ? (
                <ActionPlanPanel
                  plan={data.actionPlan}
                  title="Rencana Aksi Keyword (AI)"
                />
              ) : null}

              {opportunityPoints.length > 0 ? (
                <div className="bento-tile justify-start gap-3">
                  <div className="flex items-center justify-between">
                    <span className="bento-label">Peta peluang</span>
                    <span className="text-muted-foreground text-[11px]">
                      volume vs saturasi listing · kanan-atas = peluang tinggi
                    </span>
                  </div>
                  <KeywordOpportunityChart points={opportunityPoints} />
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 text-xs">
                <Link
                  href="/research-hub/competitor-tracker"
                  className="text-primary hover:underline"
                >
                  Competitor Tracker
                </Link>
                <span className="text-muted-foreground">·</span>
                <Link
                  href="/research-hub/trend-radar"
                  className="text-primary hover:underline"
                >
                  Trend Radar
                </Link>
                <span className="text-muted-foreground">·</span>
                <Link
                  href="/research-hub/review-intelligence"
                  className="text-primary hover:underline"
                >
                  Review Intel
                </Link>
              </div>
            </TabsContent>

            <TabsContent value="matrix" className={tabContentClass}>
              {data.matrix.length > 0 ? (
                <div className={cn(lab.card, "p-0")}>
                  <div className="p-4 pb-0">
                    <p className="text-foreground font-bold tracking-tight">
                      Keyword matrix
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Skor KOI, volume, dan sinyal per keyword.
                    </p>
                  </div>
                  <div className="p-4">
                    <KeywordMatrixTable
                      rows={data.matrix}
                      hasGoogleVolume={data.hasGoogleVolume}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Belum ada data matrix.
                </p>
              )}
            </TabsContent>

            <TabsContent value="gap" className={tabContentClass}>
              <div className="bento-tile justify-start gap-3">
                <div className="flex items-center justify-between">
                  <span className="bento-label">Keyword gap</span>
                  <span className="text-muted-foreground text-[11px] tabular-nums">
                    {data.gaps.length} peluang
                  </span>
                </div>
                {data.gaps.length > 0 ? (
                  <KeywordGapList gaps={data.gaps} />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Tidak ada gap keyword teridentifikasi.
                  </p>
                )}
              </div>

              {data.namingSuggestions.length > 0 ? (
                <div className="bento-tile justify-start gap-3">
                  <span className="bento-label">Naming intelligence</span>
                  <NamingSuggestionsCard
                    suggestions={data.namingSuggestions}
                    bare
                  />
                </div>
              ) : null}

              <CopyKeywordsPanel data={data.copyKeywords} />
            </TabsContent>

            <TabsContent value="musim" className={tabContentClass}>
              <div className="bento-tile justify-start gap-3">
                <span className="bento-label">Seasonal keyword calendar</span>
                <SeasonalKeywordChart
                  data={data.seasonalCalendar}
                  volumeByKeyword={volumeByKeyword}
                  seasonalCurves={data.seasonalCurves}
                />
              </div>

              {data.clusters.length > 0 ? (
                <div className="bento-tile justify-start gap-3">
                  <div className="flex items-center justify-between">
                    <span className="bento-label">Keyword clusters</span>
                    <span className="text-muted-foreground text-[11px] tabular-nums">
                      {data.clusters.length} tema
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {data.clusters.map((c) => (
                      <div key={c.name} className={lab.nestedPanel}>
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                          {c.keywords.join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {data.matrix.some((m) => (m.evidence?.length ?? 0) > 0) ? (
                <div className="bento-tile justify-start gap-3">
                  <span className="bento-label">Bukti sinyal</span>
                  <div className="overflow-x-auto">
                    <KeywordEvidenceTable
                      evidence={data.matrix[0]?.evidence ?? []}
                    />
                  </div>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </>
      )}
    </ResearchHubDetailPage>
  );
}

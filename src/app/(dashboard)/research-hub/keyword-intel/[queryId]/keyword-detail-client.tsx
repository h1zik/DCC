"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
import { KeywordSignalStatsChips } from "@/components/research-hub/keyword-signal-stats-line";
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
import type {
  GapKeywordRow,
  KeywordMatrixRow,
  KeywordSignalStats,
  SeasonalCurve,
} from "@/lib/research/keyword-intel/keyword-signal-types";
import {
  hub,
  ResearchHubPageHeader,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
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

function statusChipTone(
  status: KeywordIntelStatus,
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

export function KeywordDetailClient({ data }: { data: KeywordDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [briefOpen, setBriefOpen] = useState(false);
  const [roomId, setRoomId] = useState(data.rooms[0]?.id ?? "");
  const [projectName, setProjectName] = useState(`Keyword: ${data.category}`);

  const selectedRoom = data.rooms.find((r) => r.id === roomId);
  const canBrief = data.status === "READY";

  const isProcessing =
    data.status === "COLLECTING" ||
    data.status === "ANALYZING" ||
    data.status === "PENDING";

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
    <div className="flex flex-col gap-6 pb-6">
      <Link
        href="/research-hub/keyword-intel"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs transition-colors duration-150 motion-reduce:transition-none"
      >
        <Search className="size-3" aria-hidden />
        Kembali ke Keyword Intel
      </Link>

      <ResearchHubPageHeader
        variant="detail"
        icon={Search}
        eyebrow="Keyword Intel"
        title={data.category}
        description={descriptionParts.join(" · ")}
        right={
          <>
            <ResearchModelBadgeGroup meta={data.aiMeta} />
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
        footer={
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <ResearchHubStatChip
                label="Status"
                value={KEYWORD_INTEL_STATUS_LABELS[data.status]}
                tone={statusChipTone(data.status)}
              />
              <ResearchHubStatChip
                label="Keyword"
                value={data.matrix.length.toLocaleString("id-ID")}
                tone="primary"
              />
              <ResearchHubStatChip
                label="Gap"
                value={data.gaps.length.toLocaleString("id-ID")}
                tone={data.gaps.length > 0 ? "warning" : "neutral"}
              />
              {data.namingSuggestions.length > 0 ? (
                <ResearchHubStatChip
                  label="Naming"
                  value={data.namingSuggestions.length.toLocaleString("id-ID")}
                />
              ) : null}
            </div>
            <KeywordSignalStatsChips stats={data.signalStats} />
          </div>
        }
      />

      <KeywordQualityBanner dataNotice={data.dataNotice} />

      <DataSourceProvenancePanel entries={data.dataProvenance} />

      {isProcessing ? (
        <div className={hub.entrance}>
          <JobProgressBar
            title="Mengumpulkan & menganalisis keyword"
            percent={45}
            stepLabel="Pipeline sinyal marketplace, volume, dan AI berjalan di background — halaman refresh otomatis."
          />
        </div>
      ) : (
        <Tabs defaultValue="ringkasan" className="gap-0">
          <div className={cn(hub.stickyToolbar, "pb-0")}>
            <TabsList variant="line" className="h-9 w-full justify-start gap-4">
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
              <ResearchHubSection
                title="AI Summary"
                description="Ringkasan peluang keyword dari analisis multi-sumber."
                delayMs={0}
              >
                <div className={hub.panel}>
                  <p className="text-sm leading-relaxed">{data.aiSummary}</p>
                </div>
              </ResearchHubSection>
            ) : null}

            {data.actionPlan ? (
              <ResearchHubSection
                title="Rencana Aksi"
                description="Langkah prioritas dari AI berdasarkan gap & peluang."
                delayMs={50}
              >
                <ActionPlanPanel
                  plan={data.actionPlan}
                  title="Rencana Aksi Keyword (AI)"
                />
              </ResearchHubSection>
            ) : null}

            {opportunityPoints.length > 0 ? (
              <ResearchHubSection
                title="Peta Peluang"
                description="Volume vs saturasi listing — area kanan-atas = peluang tinggi."
                delayMs={100}
              >
                <div className={hub.panel}>
                  <KeywordOpportunityChart points={opportunityPoints} />
                </div>
              </ResearchHubSection>
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
            <ResearchHubSection
              title="Keyword Matrix"
              description="Skor KOI, volume, dan sinyal per keyword."
            >
              {data.matrix.length > 0 ? (
                <div className={hub.panel}>
                  <KeywordMatrixTable
                    rows={data.matrix}
                    hasGoogleVolume={data.hasGoogleVolume}
                  />
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Belum ada data matrix.
                </p>
              )}
            </ResearchHubSection>
          </TabsContent>

          <TabsContent value="gap" className={tabContentClass}>
            <ResearchHubSection
              title="Keyword Gap"
              description="Peluang yang belum tersentuh kompetitor atau listing."
            >
              {data.gaps.length > 0 ? (
                <div className={hub.panel}>
                  <KeywordGapList gaps={data.gaps} />
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Tidak ada gap keyword teridentifikasi.
                </p>
              )}
            </ResearchHubSection>

            {data.namingSuggestions.length > 0 ? (
              <ResearchHubSection
                title="Naming Intelligence"
                description="Saran nama produk dari pola keyword."
                delayMs={50}
              >
                <NamingSuggestionsCard suggestions={data.namingSuggestions} />
              </ResearchHubSection>
            ) : null}

            <ResearchHubSection
              title="Copywriting Keywords"
              description="Keyword siap pakai untuk judul, deskripsi, dan sosmed."
              delayMs={100}
            >
              <CopyKeywordsPanel data={data.copyKeywords} bare />
            </ResearchHubSection>
          </TabsContent>

          <TabsContent value="musim" className={tabContentClass}>
            <ResearchHubSection
              title="Seasonal Keyword Calendar"
              description="Pola musiman volume & momentum keyword."
            >
              <div className={hub.panel}>
                <SeasonalKeywordChart
                  data={data.seasonalCalendar}
                  volumeByKeyword={volumeByKeyword}
                  seasonalCurves={data.seasonalCurves}
                />
              </div>
            </ResearchHubSection>

            {data.clusters.length > 0 ? (
              <ResearchHubSection
                title="Keyword Clusters"
                description="Kelompok tema yang sering muncul bersama."
                delayMs={50}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.clusters.map((c, index) => (
                    <div
                      key={c.name}
                      className={cn(hub.panel, hub.entrance)}
                      style={
                        index > 0 && index < 8
                          ? { animationDelay: `${index * 40}ms` }
                          : undefined
                      }
                    >
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                        {c.keywords.join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </ResearchHubSection>
            ) : null}

            {data.matrix.some((m) => (m.evidence?.length ?? 0) > 0) ? (
              <ResearchHubSection
                title="Bukti Sinyal"
                description="Sumber data untuk keyword teratas."
                delayMs={100}
              >
                <div className={hub.panel}>
                  <KeywordEvidenceTable
                    evidence={data.matrix[0]?.evidence ?? []}
                  />
                </div>
              </ResearchHubSection>
            ) : null}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

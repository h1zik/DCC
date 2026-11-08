"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useTransition } from "react";
import {
  CalendarRange,
  Copy,
  Grid3x3,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { KeywordIntelStatus, ResearchMarketplace } from "@prisma/client";
import { toast } from "sonner";
import { refreshKeywordIntelQuery } from "@/actions/research-keyword-intel";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import { CopyKeywordsPanel } from "@/components/research-hub/copy-keywords-panel";
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
import { lab } from "@/components/lab/lab-primitives";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { RunStatusBadge, type RunTone } from "@/components/research-hub/kit/run-status";
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import type { DataProvenanceEntry } from "@/lib/research/scrape-data-provider";
import { KeywordBriefDialog } from "./keyword-brief-dialog";
import { DetailSection, KeywordOverview, KeywordProgress } from "./keyword-overview";

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

function toneOf(status: KeywordIntelStatus): RunTone {
  if (status === "READY") return "ready";
  if (status === "FAILED") return "failed";
  if (isInProgress(status)) return "running";
  return "idle";
}

const RELATED_MODULES = [
  { href: "/research-hub/competitor-tracker", label: "Competitor Tracker" },
  { href: "/research-hub/trend-radar", label: "Trend Radar" },
  { href: "/research-hub/review-intelligence", label: "Review Intelligence" },
] as const;

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-8 duration-200 motion-reduce:animate-none pt-5";

function TabCount({ value }: { value: number }) {
  if (value <= 0) return null;
  return <span className="rh-num text-muted-foreground ml-1 text-xs">{value}</span>;
}

export function KeywordDetailClient({ data }: { data: KeywordDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isProcessing = isInProgress(data.status);

  useEffect(() => {
    if (!isProcessing) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
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

  const signalTotal = data.signalStats?.total ?? 0;
  const hasSeasonal = data.seasonalCalendar.length > 0 || data.seasonalCurves.length > 0;
  const hasEvidence = data.matrix.some((m) => (m.evidence?.length ?? 0) > 0);
  const hasSummary =
    Boolean(data.aiSummary) || Boolean(data.actionPlan) || opportunityPoints.length > 0;

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshKeywordIntelQuery(data.id);
        toast.success(`"${data.category}" dianalisis ulang.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menganalisis ulang."));
      }
    });
  }

  return (
    <ResearchHubDetailPage
      icon={Search}
      backHref="/research-hub/keyword-intel"
      title={data.category}
      meta={
        <>
          <RunStatusBadge
            tone={toneOf(data.status)}
            label={KEYWORD_INTEL_STATUS_LABELS[data.status]}
          />
          {data.seedKeyword ? <span>Seed: {data.seedKeyword}</span> : null}
          <span>
            {data.marketplace
              ? MARKETPLACE_LABELS[data.marketplace]
              : "Semua marketplace"}
          </span>
          {data.volumeSource ? <span>Volume: {data.volumeSource}</span> : null}
        </>
      }
      right={
        <>
          <ResearchModelBadgeGroup meta={data.aiMeta} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={pending || isProcessing}
          >
            <RefreshCw className={cn(pending && "motion-safe:animate-spin")} aria-hidden />
            Analisis ulang
          </Button>
          {data.status === "READY" ? (
            <KeywordBriefDialog
              queryId={data.id}
              category={data.category}
              rooms={data.rooms}
            />
          ) : null}
        </>
      }
    >
      <KeywordQualityBanner dataNotice={data.dataNotice} />

      <DataSourceProvenancePanel entries={data.dataProvenance} />

      {isProcessing ? (
        <KeywordProgress status={data.status} />
      ) : (
        <>
          {data.matrix.length > 0 || signalTotal > 0 ? (
            <KeywordOverview
              keywordCount={data.matrix.length}
              highConfidenceCount={highConfidenceCount}
              gapCount={data.gaps.length}
              namingCount={data.namingSuggestions.length}
              clusterCount={data.clusters.length}
              hasGoogleVolume={data.hasGoogleVolume}
              signalStats={data.signalStats}
            />
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
                  <TabCount value={data.matrix.length} />
                </TabsTrigger>
                <TabsTrigger value="gap" className="px-1">
                  <Copy className="size-3.5" aria-hidden />
                  Gap dan copy
                  <TabCount value={data.gaps.length} />
                </TabsTrigger>
                <TabsTrigger value="musim" className="px-1">
                  <CalendarRange className="size-3.5" aria-hidden />
                  Musim
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="ringkasan" className={tabContentClass}>
              {data.aiSummary ? (
                <DetailSection id="kd-summary" title="Ringkasan AI">
                  <p className="max-w-[68ch] text-sm leading-relaxed">{data.aiSummary}</p>
                </DetailSection>
              ) : null}

              {data.actionPlan ? (
                <ActionPlanPanel plan={data.actionPlan} title="Rencana aksi keyword" />
              ) : null}

              {opportunityPoints.length > 0 ? (
                <DetailSection
                  id="kd-opportunity"
                  title="Peta peluang"
                  description="Volume pencarian dibanding saturasi listing. Keyword di kanan atas punya peluang paling besar."
                >
                  <KeywordOpportunityChart points={opportunityPoints} />
                </DetailSection>
              ) : null}

              {!hasSummary ? (
                <ResearchPanelEmpty
                  icon={Sparkles}
                  title="Ringkasan belum tersedia"
                  description="AI belum menghasilkan ringkasan atau rencana aksi untuk analisis ini. Jalankan analisis ulang untuk mencoba lagi."
                />
              ) : null}

              <nav aria-label="Lanjutkan riset" className="flex flex-col gap-2">
                <p className="rh-meta">Lanjutkan riset di modul lain</p>
                <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  {RELATED_MODULES.map((m) => (
                    <li key={m.href}>
                      <Link
                        href={m.href}
                        className="text-primary focus-visible:ring-ring rounded hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {m.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </TabsContent>

            <TabsContent value="matrix" className={tabContentClass}>
              {data.matrix.length > 0 ? (
                <DetailSection
                  id="kd-matrix"
                  title="Keyword matrix"
                  description="Skor KOI, volume, dan sinyal per keyword."
                >
                  <KeywordMatrixTable
                    rows={data.matrix}
                    hasGoogleVolume={data.hasGoogleVolume}
                  />
                </DetailSection>
              ) : (
                <ResearchPanelEmpty
                  icon={Grid3x3}
                  title="Matrix keyword masih kosong"
                  description="Tidak ada keyword yang lolos dari sinyal yang terkumpul. Coba kategori yang lebih umum atau tambah seed keyword, lalu analisis ulang."
                />
              )}
            </TabsContent>

            <TabsContent value="gap" className={tabContentClass}>
              <DetailSection
                id="kd-gap"
                title="Keyword gap"
                description="Keyword yang dicari pembeli tetapi jarang dipakai listing kompetitor."
                aside={`${data.gaps.length.toLocaleString("id-ID")} peluang`}
              >
                {data.gaps.length > 0 ? (
                  <KeywordGapList gaps={data.gaps} />
                ) : (
                  <ResearchPanelEmpty
                    icon={Copy}
                    title="Tidak ada gap keyword"
                    description="Keyword di kategori ini sudah banyak dipakai listing kompetitor. Fokus ke diferensiasi naming dan copy di bawah."
                  />
                )}
              </DetailSection>

              {data.namingSuggestions.length > 0 ? (
                <DetailSection
                  id="kd-naming"
                  title="Saran naming"
                  description="Nama produk dari pola keyword yang paling sering dicari."
                >
                  <NamingSuggestionsCard suggestions={data.namingSuggestions} bare />
                </DetailSection>
              ) : null}

              <CopyKeywordsPanel data={data.copyKeywords} />
            </TabsContent>

            <TabsContent value="musim" className={tabContentClass}>
              {hasSeasonal ? (
                <DetailSection
                  id="kd-seasonal"
                  title="Kalender keyword musiman"
                  description="Bulan ketika keyword di kategori ini biasanya naik."
                >
                  <SeasonalKeywordChart
                    data={data.seasonalCalendar}
                    volumeByKeyword={volumeByKeyword}
                    seasonalCurves={data.seasonalCurves}
                  />
                </DetailSection>
              ) : (
                <ResearchPanelEmpty
                  icon={CalendarRange}
                  title="Pola musiman belum terdeteksi"
                  description="Butuh data Google Trends atau riwayat volume untuk memetakan musim. Aktifkan Google Trends di sumber data, lalu analisis ulang."
                />
              )}

              {data.clusters.length > 0 ? (
                <DetailSection
                  id="kd-clusters"
                  title="Cluster keyword"
                  aside={`${data.clusters.length.toLocaleString("id-ID")} tema`}
                >
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
                </DetailSection>
              ) : null}

              {hasEvidence ? (
                <DetailSection
                  id="kd-evidence"
                  title="Bukti sinyal"
                  description="Sumber mentah di balik keyword teratas."
                >
                  <div className="overflow-x-auto">
                    <KeywordEvidenceTable evidence={data.matrix[0]?.evidence ?? []} />
                  </div>
                </DetailSection>
              ) : null}
            </TabsContent>
          </Tabs>
        </>
      )}
    </ResearchHubDetailPage>
  );
}

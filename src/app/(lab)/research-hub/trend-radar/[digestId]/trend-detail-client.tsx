"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendDimension, TrendPhase } from "@prisma/client";
import { Layers, Sparkles } from "lucide-react";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import { TrendPhaseBoard } from "@/components/research-hub/trend-phase-board";
import { TrendQualityBanner } from "@/components/research-hub/trend-quality-banner";
import { TrendScoreChart } from "@/components/research-hub/trend-score-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TREND_PHASE_LABELS,
  TREND_RADAR_STATUS_LABELS,
  formatRelativeTime,
} from "@/lib/research/labels";
import type { TrendEvidenceRow } from "@/lib/research/trend-radar/trend-signal-types";
import type { TrendSignalStats } from "@/lib/research/trend-radar/trend-signal-types";
import type {
  TrendConfidence,
  TrendDigestMode,
  TrendWowStatus,
} from "@prisma/client";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { lab } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import { RunStatusBadge, runToneFromStatus } from "@/components/research-hub/kit/run-status";
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
import { DetailSection, MetricList } from "./detail-section";
import { TrendBriefDialog } from "./trend-brief-dialog";
import { TrendItemDetail } from "./trend-item-detail";

export type TrendDetailData = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  digestMode: TrendDigestMode | string;
  dataNotice: string | null;
  signalStats: TrendSignalStats | null;
  priorDigestId: string | null;
  narrative: string | null;
  isGlobal: boolean;
  watchlistName: string | null;
  generatedAt: string | null;
  highlightItemId: string | null;
  actionPlan: unknown;
  aiMeta: ResearchAiMetaView | null;
  sourceLabels: string[];
  items: {
    id: string;
    name: string;
    dimension: TrendDimension;
    phase: TrendPhase;
    score: number | null;
    tmiScore: number | null;
    confidence: TrendConfidence | string;
    wowStatus: TrendWowStatus | string | null;
    narrative: string | null;
    isGlobalPipeline: boolean;
    evidence: TrendEvidenceRow[];
    sources: { type: string; snippet: string; url?: string }[];
    relatedProducts: string[];
  }[];
  rooms: {
    id: string;
    name: string;
    brandId: string | null;
    brandName: string | null;
  }[];
};

/** Segmen distribusi fase (warna kategorikal, selaras TrendPhaseBoard). */
const PHASE_SEGMENTS: { key: TrendPhase; dot: string }[] = [
  { key: TrendPhase.EMERGING, dot: "bg-amber-400" },
  { key: TrendPhase.GROWING, dot: "bg-emerald-500" },
  { key: TrendPhase.PEAK, dot: "bg-sky-500" },
  { key: TrendPhase.DECLINING, dot: "bg-rose-500" },
];

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-10 pt-6 duration-200 motion-reduce:animate-none";

export function TrendDetailClient({ data }: { data: TrendDetailData }) {
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefItemId, setBriefItemId] = useState(
    data.highlightItemId ?? data.items[0]?.id ?? "",
  );
  const [roomId, setRoomId] = useState(data.rooms[0]?.id ?? "");
  const [projectName, setProjectName] = useState("");
  const [activeTab, setActiveTab] = useState(
    data.highlightItemId ? "tren" : "ringkasan",
  );

  const selectedItem = data.items.find((i) => i.id === briefItemId);

  const periodLabel = `${new Date(data.weekStart).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${new Date(data.weekEnd).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;

  const stats = useMemo(() => {
    const phaseCounts = new Map<TrendPhase, number>();
    let highConfidence = 0;
    let wowRising = 0;
    for (const item of data.items) {
      phaseCounts.set(item.phase, (phaseCounts.get(item.phase) ?? 0) + 1);
      if (item.confidence === "HIGH") highConfidence += 1;
      if (item.wowStatus === "NEW" || item.wowStatus === "ACCELERATING") {
        wowRising += 1;
      }
    }
    const topTmi = data.items.reduce<number | null>((acc, i) => {
      const v = i.tmiScore ?? i.score;
      if (typeof v !== "number") return acc;
      return acc == null || v > acc ? v : acc;
    }, null);
    return { phaseCounts, highConfidence, wowRising, topTmi };
  }, [data.items]);

  const distTotal = data.items.length || 1;

  useEffect(() => {
    if (!data.highlightItemId) return;
    // Aktifkan tab Tren dulu (async, hindari cascading render), lalu scroll
    // ke item yang di-highlight setelah konten tab ter-render.
    const id = window.requestAnimationFrame(() => {
      setActiveTab("tren");
      window.requestAnimationFrame(() => {
        const el = document.getElementById(data.highlightItemId!);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [data.highlightItemId]);

  function openBrief(itemId: string, itemName: string) {
    setBriefItemId(itemId);
    setProjectName(`Trend: ${itemName}`);
    setBriefOpen(true);
  }

  const isLive = data.digestMode === "LIVE";
  const canExploreBrief = isLive && selectedItem?.confidence !== "LOW";

  const boardItems = data.items.map((i) => ({
    id: i.id,
    name: i.name,
    phase: i.phase,
    dimension: i.dimension,
    isGlobalPipeline: i.isGlobalPipeline,
    tmiScore: i.tmiScore ?? i.score,
    confidence: i.confidence,
    wowStatus: i.wowStatus,
  }));

  const statusLabel =
    TREND_RADAR_STATUS_LABELS[
      data.status as keyof typeof TREND_RADAR_STATUS_LABELS
    ] ?? data.status;

  const hasItems = data.items.length > 0;
  const emptyItemsDescription =
    runToneFromStatus(data.status) === "running"
      ? "Digest ini masih dibuat. Tren muncul setelah pengumpulan sinyal dan analisis selesai."
      : data.status === "FAILED"
        ? "Digest ini gagal dibuat. Generate ulang dari halaman Trend Radar."
        : "Sinyal minggu ini belum cukup untuk membentuk tren. Tambah sumber data atau seed keyword, lalu generate ulang.";

  return (
    <ResearchHubDetailPage
      backHref="/research-hub/trend-radar"
      title={data.isGlobal ? "Digest global" : (data.watchlistName ?? "Watchlist")}
      description={periodLabel}
      meta={
        <>
          <RunStatusBadge tone={runToneFromStatus(data.status)} label={statusLabel} />
          {data.generatedAt ? (
            <span>
              Dibuat{" "}
              <time dateTime={data.generatedAt}>
                {formatRelativeTime(new Date(data.generatedAt))}
              </time>
            </span>
          ) : null}
          {data.sourceLabels.length > 0 ? (
            <span>Sumber: {data.sourceLabels.join(", ")}</span>
          ) : null}
          <ResearchModelBadgeGroup meta={data.aiMeta} />
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <MetricList
          items={[
            {
              label: "Sinyal terkumpul",
              value: (data.signalStats?.total ?? 0).toLocaleString("id-ID"),
            },
            { label: "Tren terdeteksi", value: data.items.length },
            {
              label: "Confidence tinggi",
              value: (
                <>
                  {stats.highConfidence}
                  <span className="text-muted-foreground text-sm font-normal">
                    {" "}
                    dari {data.items.length}
                  </span>
                </>
              ),
            },
            { label: "Baru atau mempercepat", value: stats.wowRising },
            {
              label: "TMI tertinggi",
              value: stats.topTmi != null ? Math.round(stats.topTmi) : "—",
            },
          ]}
        />

        {hasItems ? (
          <DetailSection
            title="Distribusi fase"
            description={`${data.items.length} tren di periode ini.`}
          >
            <div
              className="bg-muted flex h-2.5 overflow-hidden rounded-full"
              role="img"
              aria-label={PHASE_SEGMENTS.map(
                (s) => `${TREND_PHASE_LABELS[s.key]} ${stats.phaseCounts.get(s.key) ?? 0}`,
              ).join(", ")}
            >
              {PHASE_SEGMENTS.map((s) => {
                const count = stats.phaseCounts.get(s.key) ?? 0;
                if (count === 0) return null;
                return (
                  <div
                    key={s.key}
                    className={s.dot}
                    style={{ width: `${(count / distTotal) * 100}%` }}
                  />
                );
              })}
            </div>
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {PHASE_SEGMENTS.map((s) => {
                const count = stats.phaseCounts.get(s.key) ?? 0;
                return (
                  <li key={s.key} className="flex items-center gap-2 text-sm">
                    <span className={cn("size-2 shrink-0 rounded-full", s.dot)} aria-hidden />
                    <span className="text-muted-foreground flex-1">
                      {TREND_PHASE_LABELS[s.key]}
                    </span>
                    <span className="rh-num font-medium">{count}</span>
                    <span className="rh-meta rh-num w-10 text-right">
                      {Math.round((count / distTotal) * 100)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </DetailSection>
        ) : null}
      </div>

      <TrendQualityBanner digestMode={data.digestMode} dataNotice={data.dataNotice} />

      <p className="rh-meta max-w-[80ch]">
        Cara skor TMI dihitung: gabungan deterministik dari search 30%, social
        25%, market 25%, dan consumer 20% (skala log per keluarga sumber),
        ditambah boost velocity. Confidence dihitung dari jumlah keluarga sumber
        yang punya sinyal, bukan opini AI. Narasi AI tidak bisa mengubah skor
        atau fase.
      </p>

      <Tabs
        value={activeTab}
        onValueChange={(v) => v && setActiveTab(v)}
        className="gap-0"
      >
        <div className={cn(lab.stickyToolbar, "pb-0")}>
          <TabsList variant="line" className="h-9 w-full justify-start gap-4">
            <TabsTrigger value="ringkasan" className="px-1">
              <Sparkles className="size-3.5" aria-hidden />
              Ringkasan
            </TabsTrigger>
            <TabsTrigger value="tren" className="px-1">
              <Layers className="size-3.5" aria-hidden />
              Tren
              {hasItems ? (
                <span className="rh-num text-muted-foreground ml-1 text-xs">
                  {data.items.length}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ringkasan" className={tabContentClass}>
          {!hasItems && !data.narrative && !data.actionPlan ? (
            <ResearchPanelEmpty
              icon={Sparkles}
              title="Belum ada ringkasan"
              description={emptyItemsDescription}
            />
          ) : (
            <>
              {data.narrative ? (
                <DetailSection title="Narasi digest">
                  <p className="text-foreground/90 max-w-[72ch] text-sm leading-relaxed">
                    {data.narrative}
                  </p>
                </DetailSection>
              ) : null}

              {data.actionPlan ? (
                <DetailSection
                  title="Rencana aksi"
                  description="Langkah berikutnya yang disarankan dari analisis AI."
                >
                  <ActionPlanPanel plan={data.actionPlan} title="Rencana aksi tren" />
                </DetailSection>
              ) : null}

              {data.items.some((i) => typeof i.score === "number") ? (
                <DetailSection
                  title="Momentum tren (TMI)"
                  description="Skor momentum tiap tren dari sinyal yang terkumpul."
                >
                  <TrendScoreChart
                    items={data.items.map((i) => ({
                      name: i.name,
                      phase: i.phase,
                      score: i.score,
                    }))}
                  />
                </DetailSection>
              ) : null}

              {hasItems ? (
                <DetailSection
                  title="Peta fase tren"
                  description="Pilih tren untuk melihat bukti sinyalnya di tab Tren."
                >
                  <TrendPhaseBoard digestId={data.id} items={boardItems} />
                </DetailSection>
              ) : null}
            </>
          )}
        </TabsContent>

        <TabsContent value="tren" className={tabContentClass}>
          {hasItems ? (
            <DetailSection
              title="Detail tren"
              description={
                isLive
                  ? "Bukti sinyal, sumber data, dan produk terkait per tren."
                  : "Bukti sinyal, sumber data, dan produk terkait per tren. Ide produk hanya bisa dibuat dari digest dengan data live."
              }
            >
              <div className="grid gap-4">
                {data.items.map((item) => (
                  <TrendItemDetail
                    key={item.id}
                    item={item}
                    highlighted={data.highlightItemId === item.id}
                    exploreDisabledReason={
                      !isLive
                        ? ""
                        : item.confidence === "LOW"
                          ? "Confidence tren ini masih rendah, belum cukup untuk dijadikan ide produk."
                          : null
                    }
                    onExplore={() => openBrief(item.id, item.name)}
                  />
                ))}
              </div>
            </DetailSection>
          ) : (
            <ResearchPanelEmpty
              icon={Layers}
              title="Belum ada tren"
              description={emptyItemsDescription}
            />
          )}
        </TabsContent>
      </Tabs>

      <TrendBriefDialog
        open={briefOpen}
        onOpenChange={setBriefOpen}
        item={selectedItem}
        canExplore={canExploreBrief}
        rooms={data.rooms}
        roomId={roomId}
        onRoomChange={setRoomId}
        projectName={projectName}
        onProjectNameChange={setProjectName}
      />
    </ResearchHubDetailPage>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { TrendDimension, TrendPhase } from "@prisma/client";
import { FileText, Globe, Layers, Radar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createProductBriefFromTrend } from "@/actions/research-brief";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import { TrendConfidenceBadge } from "@/components/research-hub/trend-confidence-badge";
import { TrendDimensionBadge } from "@/components/research-hub/trend-dimension-badge";
import { TrendEvidenceTable } from "@/components/research-hub/trend-evidence-table";
import { TrendPhaseBoard } from "@/components/research-hub/trend-phase-board";
import { TrendQualityBanner } from "@/components/research-hub/trend-quality-banner";
import { TrendScoreChart } from "@/components/research-hub/trend-score-chart";
import { TrendWowBadge } from "@/components/research-hub/trend-wow-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { lab, LabSection } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";

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

/** Segmen distribusi fase — warna selaras TrendPhaseBoard. */
const PHASE_SEGMENTS: { key: TrendPhase; label: string; dot: string }[] = [
  { key: TrendPhase.EMERGING, label: "Emerging", dot: "bg-amber-400" },
  { key: TrendPhase.GROWING, label: "Growing", dot: "bg-emerald-500" },
  { key: TrendPhase.PEAK, label: "Peak", dot: "bg-sky-500" },
  { key: TrendPhase.DECLINING, label: "Declining", dot: "bg-rose-500" },
];

function statusPillTone(status: string) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "COLLECTING":
    case "ANALYZING":
    case "PENDING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-6 duration-200 motion-reduce:animate-none pt-4";

export function TrendDetailClient({ data }: { data: TrendDetailData }) {
  const [pending, startTransition] = useTransition();
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
  const selectedRoom = data.rooms.find((r) => r.id === roomId);

  const periodLabel = `${new Date(data.weekStart).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${new Date(data.weekEnd).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;

  const descriptionParts = [
    periodLabel,
    data.generatedAt
      ? `update ${formatRelativeTime(new Date(data.generatedAt))}`
      : null,
    data.sourceLabels.length > 0
      ? `sumber: ${data.sourceLabels.join(", ")}`
      : null,
  ].filter(Boolean);

  /* --------------------------- Agregasi papan hero --------------------------- */
  const heroStats = useMemo(() => {
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
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    return () => window.cancelAnimationFrame(id);
  }, [data.highlightItemId]);

  function openBrief(itemId: string, itemName: string) {
    setBriefItemId(itemId);
    setProjectName(`Trend: ${itemName}`);
    setBriefOpen(true);
  }

  function handleBrief() {
    if (!selectedRoom?.brandId) {
      toast.error("Pilih room dengan brand.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProductBriefFromTrend({
          trendItemId: briefItemId,
          roomId,
          brandId: selectedRoom.brandId!,
          projectName: projectName || `Trend: ${selectedItem?.name ?? "Produk"}`,
        });
        toast.success("Brief dibuat.");
        setBriefOpen(false);
        window.location.href = `/projects/${result.projectId}`;
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal memproses permintaan."));
      }
    });
  }

  const canExploreBrief =
    data.digestMode === "LIVE" && selectedItem?.confidence !== "LOW";

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

  return (
    <ResearchHubDetailPage
      icon={Radar}
      backHref="/research-hub/trend-radar"
      title={data.isGlobal ? "Digest Global" : data.watchlistName ?? "Watchlist"}
      description={descriptionParts.join(" · ")}
      right={
        <>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
              statusPillTone(data.status),
            )}
          >
            {statusLabel}
          </span>
          <ResearchModelBadgeGroup meta={data.aiMeta} />
        </>
      }
    >
      {/* Papan hero bento */}
      <div
        className={cn(
          lab.entrance,
          "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4",
        )}
      >
        {/* Hero violet — total sinyal */}
        <div className="bento-tile row-span-2 border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
          <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
            Sinyal terkumpul
          </span>
          <span className="bento-value text-5xl text-white dark:text-violet-950">
            {(data.signalStats?.total ?? 0).toLocaleString("id-ID")}
          </span>
          <span className="text-xs font-medium leading-snug text-violet-100/90 dark:text-violet-900/80">
            menjadi {data.items.length} tren terdeteksi · periode {periodLabel}
          </span>
        </div>

        {/* Distribusi fase — tile lebar */}
        <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
          <div className="flex items-center justify-between">
            <span className="bento-label">Distribusi fase tren</span>
            <span className="text-muted-foreground text-[11px] tabular-nums">
              {data.items.length} tren
            </span>
          </div>
          <div className="bg-muted flex h-2.5 overflow-hidden rounded-full">
            {PHASE_SEGMENTS.map((s) => {
              const count = heroStats.phaseCounts.get(s.key) ?? 0;
              if (count === 0) return null;
              return (
                <div
                  key={s.key}
                  className={s.dot}
                  style={{ width: `${(count / distTotal) * 100}%` }}
                  title={`${TREND_PHASE_LABELS[s.key]}: ${count}`}
                />
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5">
            {PHASE_SEGMENTS.map((s) => {
              const count = heroStats.phaseCounts.get(s.key) ?? 0;
              return (
                <div key={s.key} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn("size-2 shrink-0 rounded-full", s.dot)}
                    aria-hidden
                  />
                  <span className="text-muted-foreground flex-1">
                    {TREND_PHASE_LABELS[s.key]}
                  </span>
                  <span className="font-semibold tabular-nums">{count}</span>
                  <span className="text-muted-foreground w-10 text-right text-[11px] tabular-nums">
                    {Math.round((count / distTotal) * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confidence tinggi */}
        <div className="bento-tile">
          <span className="bento-label">Confidence tinggi</span>
          <span className="bento-value">
            {heroStats.highConfidence}
            <span className="text-muted-foreground/60 text-lg font-bold">
              /{data.items.length}
            </span>
          </span>
        </div>

        {/* WoW naik — amber pastel */}
        <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
          <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
            WoW baru / mempercepat
          </span>
          <span className="bento-value text-amber-900 dark:text-amber-300">
            {heroStats.wowRising}
          </span>
        </div>
      </div>

      <TrendQualityBanner
        digestMode={data.digestMode}
        dataNotice={data.dataNotice}
      />

      <p className="text-muted-foreground text-[11px] leading-relaxed">
        Metodologi TMI: skor gabungan deterministik — search 30% · social 25% ·
        market 25% · consumer 20% (skala log per keluarga sumber) + boost
        velocity. Confidence dihitung dari jumlah keluarga sumber yang berisi
        sinyal, bukan opini AI; narasi AI tidak dapat mengubah skor/fase.
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
              {data.items.length > 0 ? (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {data.items.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ringkasan" className={tabContentClass}>
          {data.narrative ? (
            <LabSection title="Narasi Digest" delayMs={0}>
              <div className="bento-tile justify-start gap-3">
                <span className="bento-label">Narasi digest</span>
                <p className="text-sm leading-relaxed">{data.narrative}</p>
              </div>
            </LabSection>
          ) : null}

          {data.actionPlan ? (
            <LabSection
              title="Rencana Aksi"
              description="Rekomendasi langkah berikutnya dari analisis AI."
              delayMs={50}
            >
              <ActionPlanPanel plan={data.actionPlan} title="Rencana Aksi Tren (AI)" />
            </LabSection>
          ) : null}

          {data.items.some((i) => typeof i.score === "number") ? (
            <LabSection
              title="Momentum Tren (TMI)"
              description="Skor momentum tren berdasarkan sinyal yang terkumpul."
              delayMs={100}
            >
              <div className="bento-tile justify-start gap-2">
                <TrendScoreChart
                  items={data.items.map((i) => ({
                    name: i.name,
                    phase: i.phase,
                    score: i.score,
                  }))}
                />
              </div>
            </LabSection>
          ) : null}

          <LabSection
            title="Peta Fase Tren"
            description="Klik tren untuk melihat detail bukti sinyal di tab Tren."
            delayMs={150}
          >
            <TrendPhaseBoard digestId={data.id} items={boardItems} />
          </LabSection>
        </TabsContent>

        <TabsContent value="tren" className={tabContentClass}>
          <LabSection
            title="Detail Tren"
            description="Bukti sinyal, sumber data, dan produk terkait per tren."
          >
            <div className="grid gap-3">
              {data.items.map((item) => (
                <div
                  key={item.id}
                  id={item.id}
                  className={cn(
                    "bento-tile scroll-mt-24 justify-start gap-3",
                    data.highlightItemId === item.id &&
                      "ring-[var(--lab-accent,var(--primary))] animate-in fade-in ring-2 duration-300 motion-reduce:animate-none",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold tracking-tight">
                        {item.name}
                      </h3>
                      <TrendDimensionBadge dimension={item.dimension} />
                      <span className="bg-muted/70 text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold">
                        {TREND_PHASE_LABELS[item.phase]}
                      </span>
                      {typeof item.tmiScore === "number" ||
                      typeof item.score === "number" ? (
                        <TrendConfidenceBadge
                          confidence={item.confidence}
                          tmiScore={item.tmiScore ?? item.score}
                        />
                      ) : null}
                      <TrendWowBadge status={item.wowStatus} />
                      {item.isGlobalPipeline ? (
                        <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[10px]">
                          <Globe className="size-3" aria-hidden />
                          Global → Local
                        </span>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        item.confidence === "LOW" || data.digestMode !== "LIVE"
                      }
                      title={
                        item.confidence === "LOW" || data.digestMode !== "LIVE"
                          ? "Explore hanya untuk digest LIVE dengan confidence ≥ MED"
                          : undefined
                      }
                      onClick={() => openBrief(item.id, item.name)}
                    >
                      <FileText className="size-3.5" aria-hidden />
                      Explore
                    </Button>
                  </div>

                  {item.narrative ? (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {item.narrative}
                    </p>
                  ) : null}

                  {item.evidence.length > 0 ? (
                    <div>
                      <p className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wide">
                        Bukti sinyal
                      </p>
                      <TrendEvidenceTable evidence={item.evidence} />
                    </div>
                  ) : item.sources.length > 0 ? (
                    <div>
                      <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase tracking-wide">
                        Sumber data
                      </p>
                      <ul className="text-muted-foreground space-y-1 text-xs">
                        {item.sources.map((s, idx) => (
                          <li key={idx}>
                            <span className="text-foreground font-medium">
                              {s.type}:
                            </span>{" "}
                            {s.url ? (
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:underline"
                              >
                                {s.snippet}
                              </a>
                            ) : (
                              s.snippet
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {item.relatedProducts.length > 0 ? (
                    <div>
                      <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase tracking-wide">
                        Produk terkait
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.relatedProducts.map((p) => (
                          <span
                            key={p}
                            className="bg-muted/60 rounded-full px-2.5 py-1 text-xs"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </LabSection>
        </TabsContent>
      </Tabs>

      <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Explore sebagai Product Idea</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-muted-foreground text-sm">
              Tren: <strong>{selectedItem?.name}</strong>
            </p>
            <div className="grid gap-1.5">
              <Label>Room / Brand</Label>
              <Select
                value={roomId}
                items={data.rooms.map((r) => ({
                  value: r.id,
                  label: r.brandName ? `${r.name} — ${r.brandName}` : r.name,
                }))}
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
            <Button onClick={handleBrief} disabled={pending || !canExploreBrief}>
              Buat Brief
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResearchHubDetailPage>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
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
import type { TrendConfidence, TrendDigestMode, TrendWowStatus } from "@prisma/client";
import {
  hub,
  ResearchHubPageHeader,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
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

function statusChipTone(
  status: string,
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
    TREND_RADAR_STATUS_LABELS[data.status as keyof typeof TREND_RADAR_STATUS_LABELS] ??
      data.status,
    data.generatedAt
      ? formatRelativeTime(new Date(data.generatedAt))
      : null,
  ].filter(Boolean);

  useEffect(() => {
    if (!data.highlightItemId) return;
    setActiveTab("tren");
    const id = window.requestAnimationFrame(() => {
      const el = document.getElementById(data.highlightItemId!);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/research-hub/trend-radar"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs transition-colors duration-150 motion-reduce:transition-none"
      >
        <Radar className="size-3" aria-hidden />
        Kembali ke Trend Radar
      </Link>

      <ResearchHubPageHeader
        variant="detail"
        icon={Radar}
        eyebrow="Trend Radar"
        title={data.isGlobal ? "Digest Global" : data.watchlistName ?? "Watchlist"}
        description={descriptionParts.join(" · ")}
        right={<ResearchModelBadgeGroup meta={data.aiMeta} />}
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <ResearchHubStatChip
              label="Status"
              value={
                TREND_RADAR_STATUS_LABELS[
                  data.status as keyof typeof TREND_RADAR_STATUS_LABELS
                ] ?? data.status
              }
              tone={statusChipTone(data.status)}
            />
            {data.signalStats ? (
              <ResearchHubStatChip
                label="Sinyal"
                value={data.signalStats.total.toLocaleString("id-ID")}
                tone="primary"
              />
            ) : null}
            <ResearchHubStatChip
              label="Tren"
              value={data.items.length.toLocaleString("id-ID")}
            />
            {data.sourceLabels.map((label) => (
              <ResearchHubStatChip key={label} label="Sumber" value={label} />
            ))}
          </div>
        }
      />

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
        <div className={cn(hub.stickyToolbar, "pb-0")}>
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
            <ResearchHubSection title="Narasi Digest" delayMs={0}>
              <div className={cn(hub.panel, "text-sm leading-relaxed")}>
                {data.narrative}
              </div>
            </ResearchHubSection>
          ) : null}

          {data.actionPlan ? (
            <ResearchHubSection
              title="Rencana Aksi"
              description="Rekomendasi langkah berikutnya dari analisis AI."
              delayMs={50}
            >
              <ActionPlanPanel plan={data.actionPlan} title="Rencana Aksi Tren (AI)" />
            </ResearchHubSection>
          ) : null}

          {data.items.some((i) => typeof i.score === "number") ? (
            <ResearchHubSection
              title="Momentum Tren (TMI)"
              description="Skor momentum tren berdasarkan sinyal yang terkumpul."
              delayMs={100}
            >
              <div className={hub.panel}>
                <TrendScoreChart
                  items={data.items.map((i) => ({
                    name: i.name,
                    phase: i.phase,
                    score: i.score,
                  }))}
                />
              </div>
            </ResearchHubSection>
          ) : null}

          <ResearchHubSection
            title="Peta Fase Tren"
            description="Klik tren untuk melihat detail bukti sinyal di tab Tren."
            delayMs={150}
          >
            <TrendPhaseBoard digestId={data.id} items={boardItems} />
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="tren" className={tabContentClass}>
          <ResearchHubSection
            title="Detail Tren"
            description="Bukti sinyal, sumber data, dan produk terkait per tren."
          >
            <div className="grid gap-4">
              {data.items.map((item) => (
                <div
                  key={item.id}
                  id={item.id}
                  className={cn(
                    hub.panel,
                    "scroll-mt-24 space-y-3",
                    data.highlightItemId === item.id &&
                      "ring-primary animate-in fade-in ring-2 duration-300 motion-reduce:animate-none",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{item.name}</h3>
                      <TrendDimensionBadge dimension={item.dimension} />
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold">
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
                      <p className="mb-2 text-xs font-medium">Bukti sinyal</p>
                      <TrendEvidenceTable evidence={item.evidence} />
                    </div>
                  ) : item.sources.length > 0 ? (
                    <div>
                      <p className="mb-1 text-xs font-medium">Sumber data</p>
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
                      <p className="mb-1 text-xs font-medium">Produk terkait</p>
                      <p className="text-muted-foreground text-xs">
                        {item.relatedProducts.join(", ")}
                      </p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </ResearchHubSection>
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
    </div>
  );
}

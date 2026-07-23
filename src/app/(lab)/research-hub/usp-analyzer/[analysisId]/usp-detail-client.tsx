"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  BarChart3,
  FileText,
  Grid3x3,
  Layers,
  Map,
  RefreshCw,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { UspGapStatus } from "@prisma/client";
import { toast } from "sonner";
import { createProductBriefFromUsp } from "@/actions/research-brief";
import { createProductConcept } from "@/actions/research-concept-lab";
import { refreshUspGapAnalysis } from "@/actions/research-usp-gap";
import { ProductConceptMode } from "@prisma/client";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import { AiFeedbackButtons } from "@/components/research-hub/ai-feedback-buttons";
import { ClaimAnalysisPanel } from "@/components/research-hub/claim-analysis-panel";
import { ContextQualityBanner } from "@/components/research-hub/context-quality-banner";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { UspSourcesUsedPanel } from "@/components/research-hub/usp-sources-used-panel";
import {
  GapMatrixTable,
  type GapMatrixRow,
} from "@/components/research-hub/gap-matrix-table";
import { PositioningScatterChart } from "@/components/research-hub/positioning-scatter-chart";
import {
  UspCandidateCards,
  type UspCandidate,
} from "@/components/research-hub/usp-candidate-cards";
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
import { USP_GAP_STATUS_LABELS } from "@/lib/research/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { assessStoredContextQuality } from "@/lib/research/usp-gap/context-quality";
import type {
  StoredContextModules,
  ResolvedContextSources,
} from "@/lib/research/usp-gap/context-types";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { lab, LabSection } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";

export type UspDetailData = {
  id: string;
  analysisId: string;
  category: string;
  status: UspGapStatus;
  errorMessage: string | null;
  aiSummary: string | null;
  differentiationScore: number | null;
  categoryDecision: {
    verdict: "GO" | "WATCH" | "AVOID";
    confidence: number;
    reason: string;
  } | null;
  actionPlan: unknown;
  aiMeta: ResearchAiMetaView | null;
  gapMatrix: GapMatrixRow[];
  claimAnalysis: { overused?: string[]; underserved?: string[] };
  positioningMap: {
    axisX: string;
    axisY: string;
    points: { name: string; brand: string; x: number; y: number }[];
  };
  uspCandidates: UspCandidate[];
  resolvedSources: ResolvedContextSources | null;
  contextModules: StoredContextModules;
  rooms: {
    id: string;
    name: string;
    brandId: string | null;
    brandName: string | null;
  }[];
};

const VERDICT_META: Record<
  "GO" | "WATCH" | "AVOID",
  { label: string; pill: string; dot: string }
> = {
  GO: {
    label: "GO — Masuk kategori",
    pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  WATCH: {
    label: "WATCH — Pantau dulu",
    pill: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  AVOID: {
    label: "AVOID — Hindari",
    pill: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

function statusPillTone(status: UspGapStatus) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "FAILED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "GATHERING":
    case "ANALYZING":
    case "PENDING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-6 duration-200 motion-reduce:animate-none pt-4";

export function UspDetailClient({ data }: { data: UspDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [briefOpen, setBriefOpen] = useState(false);
  const [uspIndex, setUspIndex] = useState(0);
  const [roomId, setRoomId] = useState(data.rooms[0]?.id ?? "");
  const [projectName, setProjectName] = useState(`USP: ${data.category}`);
  const [gapQuery, setGapQuery] = useState("");

  const selectedRoom = data.rooms.find((r) => r.id === roomId);
  const inProgress =
    data.status === "GATHERING" ||
    data.status === "ANALYZING" ||
    data.status === "PENDING";

  const contextQuality = useMemo(
    () => assessStoredContextQuality(data.contextModules),
    [data.contextModules],
  );

  const roomItems = useMemo(
    (): SelectItemDef[] =>
      data.rooms.map((r) => ({ value: r.id, label: r.name })),
    [data.rooms],
  );

  /* --------------------------- Gap matrix: filter --------------------------- */
  const visibleGapRows = useMemo(() => {
    const q = gapQuery.trim().toLowerCase();
    if (!q) return data.gapMatrix;
    return data.gapMatrix.filter(
      (row) =>
        row.claim.toLowerCase().includes(q) ||
        row.opportunity.toLowerCase().includes(q) ||
        (row.recommendedAction ?? "").toLowerCase().includes(q),
    );
  }, [data.gapMatrix, gapQuery]);

  /* --------------------------- Agregasi papan hero --------------------------- */
  const heroStats = useMemo(() => {
    const bigGaps = data.gapMatrix.filter((r) => r.gapScore >= 70).length;
    const p0 = data.gapMatrix.filter((r) => r.priority === "P0").length;
    const topUsp = data.uspCandidates.reduce<number | null>(
      (acc, c) =>
        acc == null || c.differentiationScore > acc
          ? c.differentiationScore
          : acc,
      null,
    );
    return { bigGaps, p0, topUsp };
  }, [data.gapMatrix, data.uspCandidates]);

  useEffect(() => {
    if (!inProgress) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
    return () => window.clearInterval(id);
  }, [inProgress, router]);

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshUspGapAnalysis(data.id);
        toast.success("Refresh dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal refresh."));
      }
    });
  }

  function openBrief(index: number) {
    setUspIndex(index);
    setBriefOpen(true);
  }

  function handleCreateConcept(index: number) {
    const usp = data.uspCandidates[index]?.usp ?? data.category;
    startTransition(async () => {
      try {
        const result = await createProductConcept({
          mode: ProductConceptMode.AI_GENERATED,
          title: usp.slice(0, 120),
          category: data.category,
          uspGapAnalysisId: data.analysisId,
          uspIndex: index,
        });
        toast.success("Konsep produk dibuat.");
        router.push(`/research-hub/concept-lab/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat konsep."));
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
        const result = await createProductBriefFromUsp({
          analysisId: data.id,
          uspIndex,
          roomId,
          brandId: selectedRoom.brandId!,
          projectName,
        });
        toast.success("Product brief dibuat.");
        setBriefOpen(false);
        router.push(`/projects/${result.projectId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat brief."));
      }
    });
  }

  const verdict = data.categoryDecision
    ? VERDICT_META[data.categoryDecision.verdict]
    : null;

  return (
    <ResearchHubDetailPage
      icon={BarChart3}
      backHref="/research-hub/usp-analyzer"
      title={data.category}
      description="Gap matrix, positioning map, dan kandidat USP dari agregasi modul riset."
      right={
        <>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
              statusPillTone(data.status),
            )}
          >
            {USP_GAP_STATUS_LABELS[data.status]}
          </span>
          <ResearchModelBadgeGroup meta={data.aiMeta} />
          <Button size="sm" onClick={handleRefresh} disabled={pending || inProgress}>
            <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
            Refresh
          </Button>
        </>
      }
    >
      {inProgress ? (
        <div className={lab.entrance}>
          <JobProgressBar
            title={
              data.status === "GATHERING"
                ? "Mengumpulkan konteks riset"
                : "Menganalisis gap & USP"
            }
            percent={data.status === "GATHERING" ? 35 : 65}
            stepLabel="Pipeline modul 1–5 + AI pro berjalan di background — halaman refresh otomatis."
          />
        </div>
      ) : null}

      {/* Papan hero bento */}
      <div
        className={cn(
          lab.entrance,
          "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4",
        )}
      >
        {/* Hero violet — differentiation score */}
        <div className="bento-tile row-span-2 border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
          <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
            Differentiation score
          </span>
          <span className="bento-value text-5xl text-white dark:text-violet-950">
            {data.differentiationScore != null
              ? Math.round(data.differentiationScore)
              : "—"}
            {data.differentiationScore != null ? (
              <span className="text-2xl font-bold text-violet-200/80 dark:text-violet-900/60">
                /100
              </span>
            ) : null}
          </span>
          <span className="text-xs font-medium leading-snug text-violet-100/90 dark:text-violet-900/80">
            seberapa mudah kategori ini dibedakan dari kompetitor
          </span>
        </div>

        {/* Verdict — tile lebar */}
        <div className="bento-tile col-span-2 row-span-2 justify-start gap-3">
          <span className="bento-label">Keputusan kategori</span>
          {data.categoryDecision && verdict ? (
            <>
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold",
                    verdict.pill,
                  )}
                >
                  <span
                    className={cn("size-2 rounded-full", verdict.dot)}
                    aria-hidden
                  />
                  {verdict.label}
                </span>
                <span
                  className="text-muted-foreground text-xs font-medium"
                  title="Estimasi AI, dibatasi cakupan data: verdict dengan konteks modul minim otomatis diturunkan keyakinannya."
                >
                  Keyakinan {Math.round(data.categoryDecision.confidence * 100)}%
                  (estimasi AI)
                </span>
              </div>
              {data.categoryDecision.reason ? (
                <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
                  {data.categoryDecision.reason}
                </p>
              ) : null}
              <AiFeedbackButtons
                module="usp-analyzer"
                artifactType="usp-verdict"
                artifactId={data.id}
                label="Verdict akurat?"
                className="mt-auto"
              />
            </>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Verdict GO / WATCH / AVOID muncul setelah analisis selesai.
            </p>
          )}
        </div>

        {/* Kandidat USP */}
        <div className="bento-tile">
          <span className="bento-label">Kandidat USP</span>
          <span className="bento-value">
            {data.uspCandidates.length}
            {heroStats.topUsp != null ? (
              <span className="text-muted-foreground/60 text-lg font-bold">
                {" "}
                · top {heroStats.topUsp}
              </span>
            ) : null}
          </span>
        </div>

        {/* Gap besar — amber pastel */}
        <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
          <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
            Gap skor ≥ 70
          </span>
          <span className="bento-value text-amber-900 dark:text-amber-300">
            {heroStats.bigGaps}
            <span className="text-lg font-bold text-amber-800/50 dark:text-amber-300/50">
              /{data.gapMatrix.length}
            </span>
          </span>
          <span className="text-[11px] font-medium text-amber-800/60 dark:text-amber-200/50">
            {heroStats.p0 > 0 ? `${heroStats.p0} prioritas P0` : "peluang besar"}
          </span>
        </div>

        {/* Klaim underserved / overused */}
        <div className="bento-tile">
          <span className="bento-label">Klaim underserved</span>
          <span className="bento-value">
            {(data.claimAnalysis.underserved ?? []).length}
          </span>
        </div>
        <div className="bento-tile">
          <span className="bento-label">Klaim overused</span>
          <span className="bento-value">
            {(data.claimAnalysis.overused ?? []).length}
          </span>
        </div>

        {/* Cakupan data — lavender pastel */}
        <div className="bento-tile col-span-2 border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
          <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
            Cakupan data konteks
          </span>
          <span className="bento-value text-violet-900 dark:text-violet-300">
            {contextQuality.coveragePct}
            <span className="text-lg font-bold text-violet-700/50 dark:text-violet-300/50">
              %
            </span>
          </span>
          <span className="bg-violet-900/10 flex h-1.5 overflow-hidden rounded-full dark:bg-violet-300/10">
            <span
              className="bg-violet-600 h-full rounded-full dark:bg-violet-400"
              style={{
                width: `${Math.min(100, Math.max(0, contextQuality.coveragePct))}%`,
              }}
            />
          </span>
        </div>
      </div>

      <ContextQualityBanner
        notice={contextQuality.notice}
        warnings={contextQuality.warnings}
        coveragePct={contextQuality.coveragePct}
      />

      <Tabs defaultValue="ringkasan" className="gap-0">
        <div className={cn(lab.stickyToolbar, "pb-0")}>
          <TabsList variant="line" className="h-9 w-full justify-start gap-4">
            <TabsTrigger value="ringkasan" className="px-1">
              <Sparkles className="size-3.5" aria-hidden />
              Ringkasan
            </TabsTrigger>
            <TabsTrigger value="gap" className="px-1">
              <Grid3x3 className="size-3.5" aria-hidden />
              Gap Matrix
              {data.gapMatrix.length > 0 ? (
                <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
                  {data.gapMatrix.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="positioning" className="px-1">
              <Map className="size-3.5" aria-hidden />
              Positioning
            </TabsTrigger>
            <TabsTrigger value="usp" className="px-1">
              <Target className="size-3.5" aria-hidden />
              USP
              {data.uspCandidates.length > 0 ? (
                <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
                  {data.uspCandidates.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="sumber" className="px-1">
              <Layers className="size-3.5" aria-hidden />
              Sumber
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ringkasan" className={tabContentClass}>
          {data.aiSummary ? (
            <LabSection title="AI Summary" delayMs={0}>
              <div className="bento-tile justify-start gap-3">
                <span className="bento-label">Ringkasan AI</span>
                <p className="text-sm leading-relaxed">{data.aiSummary}</p>
              </div>
            </LabSection>
          ) : null}

          {data.actionPlan ? (
            <LabSection
              title="Rencana Aksi"
              description="Langkah prioritas dari analisis gap."
              delayMs={50}
            >
              <ActionPlanPanel plan={data.actionPlan} title="Rencana Aksi Gap (AI)" />
            </LabSection>
          ) : null}

          <LabSection
            title="Claim Analysis"
            description="Klaim yang sudah dipakai kompetitor vs yang masih kosong."
            delayMs={100}
          >
            <ClaimAnalysisPanel data={data.claimAnalysis} />
          </LabSection>
        </TabsContent>

        <TabsContent value="gap" className={tabContentClass}>
          <LabSection
            title="Gap Matrix"
            description="Skor peluang per klaim/benefit dengan bukti dari modul riset."
          >
            <div className={cn(lab.card, "p-0")}>
              {/* Toolbar tabel */}
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-foreground font-bold tracking-tight">
                    Peluang klaim
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {visibleGapRows.length === data.gapMatrix.length
                      ? `${data.gapMatrix.length} klaim`
                      : `${visibleGapRows.length} dari ${data.gapMatrix.length} klaim`}
                  </p>
                </div>
                {data.gapMatrix.length > 5 ? (
                  <div className="relative">
                    <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
                    <Input
                      value={gapQuery}
                      onChange={(e) => setGapQuery(e.target.value)}
                      placeholder="Cari klaim / peluang…"
                      className="h-9 w-56 pl-8 text-xs"
                    />
                  </div>
                ) : null}
              </div>
              <GapMatrixTable rows={visibleGapRows} />
            </div>
          </LabSection>
        </TabsContent>

        <TabsContent value="positioning" className={tabContentClass}>
          <LabSection
            title="Positioning Map"
            description={`${data.positioningMap.axisX} × ${data.positioningMap.axisY}`}
          >
            <div className="bento-tile justify-start gap-2">
              <div className="flex items-center justify-between">
                <span className="bento-label">
                  {data.positioningMap.axisX} × {data.positioningMap.axisY}
                </span>
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {data.positioningMap.points.length} produk
                </span>
              </div>
              <PositioningScatterChart
                axisX={data.positioningMap.axisX}
                axisY={data.positioningMap.axisY}
                points={data.positioningMap.points}
              />
            </div>
          </LabSection>
        </TabsContent>

        <TabsContent value="usp" className={tabContentClass}>
          <LabSection
            title="USP Generator"
            description="Kandidat USP dengan RTB, skor diferensiasi, dan risiko."
          >
            <UspCandidateCards
              candidates={data.uspCandidates}
              onCreateBrief={openBrief}
              onCreateConcept={handleCreateConcept}
              briefPending={pending}
              conceptPending={pending}
            />
          </LabSection>
        </TabsContent>

        <TabsContent value="sumber" className={tabContentClass}>
          <LabSection
            title="Sumber Data Digunakan"
            description="Provenance dari modul riset yang mengisi analisis ini."
          >
            <UspSourcesUsedPanel
              sources={data.resolvedSources}
              matchQuality={data.contextModules.matchQuality}
            />
          </LabSection>
        </TabsContent>
      </Tabs>

      <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4" aria-hidden />
              Buat Product Brief dari USP
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium">
              {data.uspCandidates[uspIndex]?.usp ?? "—"}
            </p>
            <div className="space-y-2">
              <Label>Room</Label>
              <Select
                value={roomId}
                items={roomItems}
                onValueChange={(v) => v && setRoomId(v)}
              >
                <SelectTrigger />
                <SelectContent>
                  {data.rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nama proyek</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleBrief} disabled={pending}>
              Buat Brief
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResearchHubDetailPage>
  );
}

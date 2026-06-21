"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  BarChart3,
  FileText,
  Grid3x3,
  Layers,
  Map,
  RefreshCw,
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
import { ClaimAnalysisPanel } from "@/components/research-hub/claim-analysis-panel";
import { ContextQualityBanner } from "@/components/research-hub/context-quality-banner";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { UspSourcesUsedPanel } from "@/components/research-hub/usp-sources-used-panel";
import { DifferentiationScoreBadge } from "@/components/research-hub/differentiation-score-badge";
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
import { assessStoredContextQuality } from "@/lib/research/usp-gap/context-quality";
import type { StoredContextModules, ResolvedContextSources } from "@/lib/research/usp-gap/context-types";
import {
  hub,
  ResearchHubPageHeader,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
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

const VERDICT_STYLE: Record<
  "GO" | "WATCH" | "AVOID",
  { label: string; tone: string }
> = {
  GO: {
    label: "GO — Masuk kategori",
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  },
  WATCH: {
    label: "WATCH — Pantau dulu",
    tone: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  },
  AVOID: {
    label: "AVOID — Hindari",
    tone: "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200",
  },
};

function statusChipTone(
  status: UspGapStatus,
): "neutral" | "success" | "warning" | "primary" {
  switch (status) {
    case "READY":
      return "success";
    case "FAILED":
      return "warning";
    case "GATHERING":
    case "ANALYZING":
    case "PENDING":
      return "warning";
    default:
      return "neutral";
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

  const selectedRoom = data.rooms.find((r) => r.id === roomId);
  const inProgress =
    data.status === "GATHERING" ||
    data.status === "ANALYZING" ||
    data.status === "PENDING";

  const contextQuality = useMemo(
    () => assessStoredContextQuality(data.contextModules),
    [data.contextModules],
  );

  useEffect(() => {
    if (!inProgress) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
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

  return (
    <div className="flex flex-col gap-6 pb-6">
      <Link
        href="/research-hub/usp-analyzer"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs transition-colors duration-150 motion-reduce:transition-none"
      >
        <BarChart3 className="size-3" aria-hidden />
        Kembali ke USP Analyzer
      </Link>

      <ResearchHubPageHeader
        variant="detail"
        icon={BarChart3}
        eyebrow="USP & Gap Analyzer"
        title={data.category}
        description="Gap matrix, positioning map, dan kandidat USP dari agregasi modul riset."
        right={
          <>
            <ResearchModelBadgeGroup meta={data.aiMeta} />
            <DifferentiationScoreBadge score={data.differentiationScore} />
            <Button size="sm" onClick={handleRefresh} disabled={pending || inProgress}>
              <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
              Refresh
            </Button>
          </>
        }
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <ResearchHubStatChip
              label="Status"
              value={USP_GAP_STATUS_LABELS[data.status]}
              tone={statusChipTone(data.status)}
            />
            <ResearchHubStatChip
              label="USP"
              value={data.uspCandidates.length.toLocaleString("id-ID")}
              tone="primary"
            />
            <ResearchHubStatChip
              label="Gap"
              value={data.gapMatrix.length.toLocaleString("id-ID")}
            />
            {data.categoryDecision ? (
              <ResearchHubStatChip
                label="Verdict"
                value={data.categoryDecision.verdict}
                tone={
                  data.categoryDecision.verdict === "GO"
                    ? "success"
                    : data.categoryDecision.verdict === "AVOID"
                      ? "warning"
                      : "neutral"
                }
              />
            ) : null}
            <ResearchHubStatChip
              label="Cakupan data"
              value={`${contextQuality.coveragePct}%`}
              tone={contextQuality.coveragePct >= 70 ? "success" : "warning"}
            />
          </div>
        }
      />

      {inProgress ? (
        <div className={hub.entrance}>
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

      <ContextQualityBanner
        notice={contextQuality.notice}
        warnings={contextQuality.warnings}
        coveragePct={contextQuality.coveragePct}
      />

      {data.categoryDecision ? (
        <div
          className={cn(
            hub.nestedPanel,
            "flex flex-wrap items-center gap-3",
            VERDICT_STYLE[data.categoryDecision.verdict].tone,
          )}
        >
          <span className="text-sm font-bold uppercase tracking-wide">
            {VERDICT_STYLE[data.categoryDecision.verdict].label}
          </span>
          <span className="text-xs font-medium opacity-80">
            Keyakinan {Math.round(data.categoryDecision.confidence * 100)}%
          </span>
          {data.categoryDecision.reason ? (
            <span className="text-foreground/80 w-full text-xs leading-snug sm:w-auto sm:flex-1">
              {data.categoryDecision.reason}
            </span>
          ) : null}
        </div>
      ) : null}

      <Tabs defaultValue="ringkasan" className="gap-0">
        <div className={cn(hub.stickyToolbar, "pb-0")}>
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
            <ResearchHubSection title="AI Summary" delayMs={0}>
              <div className={cn(hub.panel, "text-sm leading-relaxed")}>
                {data.aiSummary}
              </div>
            </ResearchHubSection>
          ) : null}

          {data.actionPlan ? (
            <ResearchHubSection
              title="Rencana Aksi"
              description="Langkah prioritas dari analisis gap."
              delayMs={50}
            >
              <ActionPlanPanel plan={data.actionPlan} title="Rencana Aksi Gap (AI)" />
            </ResearchHubSection>
          ) : null}

          <ResearchHubSection
            title="Claim Analysis"
            description="Klaim yang sudah dipakai kompetitor vs yang masih kosong."
            delayMs={100}
          >
            <ClaimAnalysisPanel data={data.claimAnalysis} />
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="gap" className={tabContentClass}>
          <ResearchHubSection
            title="Gap Matrix"
            description="Skor peluang per klaim/benefit dengan bukti dari modul riset."
          >
            <div className={hub.panel}>
              <GapMatrixTable rows={data.gapMatrix} />
            </div>
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="positioning" className={tabContentClass}>
          <ResearchHubSection
            title="Positioning Map"
            description={`${data.positioningMap.axisX} × ${data.positioningMap.axisY}`}
          >
            <div className={hub.panel}>
              <PositioningScatterChart
                axisX={data.positioningMap.axisX}
                axisY={data.positioningMap.axisY}
                points={data.positioningMap.points}
              />
            </div>
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="usp" className={tabContentClass}>
          <ResearchHubSection
            title="USP Generator"
            description="Kandidat USP dengan RTB, skor diferensiasi, dan risiko."
          >
            <div className={hub.panel}>
              <UspCandidateCards
                candidates={data.uspCandidates}
                onCreateBrief={openBrief}
                onCreateConcept={handleCreateConcept}
                briefPending={pending}
                conceptPending={pending}
              />
            </div>
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="sumber" className={tabContentClass}>
          <ResearchHubSection
            title="Sumber Data Digunakan"
            description="Provenance dari modul riset yang mengisi analisis ini."
          >
            <UspSourcesUsedPanel sources={data.resolvedSources} />
          </ResearchHubSection>
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
              <Select value={roomId} onValueChange={(v) => v && setRoomId(v)}>
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
    </div>
  );
}

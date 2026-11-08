"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  BarChart3,
  Grid3x3,
  Layers,
  Map,
  RefreshCw,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { ProductConceptMode, UspGapStatus } from "@prisma/client";
import { toast } from "sonner";
import { createProductConcept } from "@/actions/research-concept-lab";
import { refreshUspGapAnalysis } from "@/actions/research-usp-gap";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import { AiFeedbackButtons } from "@/components/research-hub/ai-feedback-buttons";
import { ClaimAnalysisPanel } from "@/components/research-hub/claim-analysis-panel";
import { ContextQualityBanner } from "@/components/research-hub/context-quality-banner";
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { USP_GAP_STATUS_LABELS } from "@/lib/research/labels";
import { assessStoredContextQuality } from "@/lib/research/usp-gap/context-quality";
import type {
  StoredContextModules,
  ResolvedContextSources,
} from "@/lib/research/usp-gap/context-types";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
import { lab } from "@/components/lab/lab-primitives";
import { RunStatusBadge, type RunTone } from "@/components/research-hub/kit/run-status";
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import { UspBriefDialog } from "./usp-brief-dialog";
import { ResearchRunningNote } from "@/components/research-hub/kit/research-section";

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
  { label: string; tone: RunTone }
> = {
  GO: { label: "Masuk kategori", tone: "ready" },
  WATCH: { label: "Pantau dulu", tone: "running" },
  AVOID: { label: "Hindari", tone: "failed" },
};

function toneOf(status: UspGapStatus): RunTone {
  if (status === "READY") return "ready";
  if (status === "FAILED") return "failed";
  if (status === "GATHERING" || status === "ANALYZING" || status === "PENDING") return "running";
  return "idle";
}

const tabContentClass =
  "animate-in fade-in duration-200 motion-reduce:animate-none flex flex-col gap-8 pt-5";

function Section({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="rh-section-title">{title}</h2>
          {meta ? <p className="rh-meta">{meta}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="rh-meta">{label}</dt>
      <dd className="rh-num text-foreground mt-0.5 text-lg font-semibold">{children}</dd>
    </div>
  );
}

export function UspDetailClient({ data }: { data: UspDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [briefOpen, setBriefOpen] = useState(false);
  const [uspIndex, setUspIndex] = useState(0);
  const [gapQuery, setGapQuery] = useState("");

  const tone = toneOf(data.status);
  const inProgress = tone === "running";

  const contextQuality = useMemo(
    () => assessStoredContextQuality(data.contextModules),
    [data.contextModules],
  );

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

  const stats = useMemo(() => {
    const bigGaps = data.gapMatrix.filter((r) => r.gapScore >= 70).length;
    const p0 = data.gapMatrix.filter((r) => r.priority === "P0").length;
    const topUsp = data.uspCandidates.reduce<number | null>(
      (acc, c) => (acc == null || c.differentiationScore > acc ? c.differentiationScore : acc),
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
        toast.success("Analisis dijalankan ulang.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Analisis ulang gagal dimulai."));
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
        toast.error(actionErrorMessage(err, "Konsep produk gagal dibuat."));
      }
    });
  }

  const verdict = data.categoryDecision ? VERDICT_META[data.categoryDecision.verdict] : null;
  const underserved = (data.claimAnalysis.underserved ?? []).length;
  const overused = (data.claimAnalysis.overused ?? []).length;

  return (
    <ResearchHubDetailPage
      icon={BarChart3}
      backHref="/research-hub/usp-analyzer"
      title={data.category}
      description="Gap matrix, positioning map, dan kandidat USP dari gabungan modul riset."
      meta={
        <>
          <RunStatusBadge tone={tone} label={USP_GAP_STATUS_LABELS[data.status]} />
          <ResearchModelBadgeGroup meta={data.aiMeta} />
        </>
      }
      right={
        <Button size="sm" variant="outline" onClick={handleRefresh} disabled={pending || inProgress}>
          <RefreshCw className={cn(pending && "motion-safe:animate-spin")} aria-hidden />
          Analisis ulang
        </Button>
      }
    >
      {inProgress ? (
        <ResearchRunningNote
          title={<>{data.status === "ANALYZING"
                ? "Langkah 2 dari 2: AI menyusun gap matrix dan kandidat USP"
                : "Langkah 1 dari 2: mengumpulkan konteks dari modul riset"}</>}
          description={<>Halaman ini diperbarui otomatis setiap beberapa detik.</>}
        />
      ) : null}

      {data.status === "FAILED" && data.errorMessage ? (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          <p className="font-medium">Analisis gagal</p>
          <p className="mt-0.5">{data.errorMessage}</p>
          <p className="mt-1 text-xs">Periksa sumber data, lalu klik Analisis ulang.</p>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section aria-labelledby="usp-score-title" className="flex flex-col gap-4">
          <h2 id="usp-score-title" className="sr-only">Angka utama</h2>
          <div>
            <p className="rh-meta">Skor diferensiasi</p>
            <p className="rh-num text-foreground mt-1 text-4xl font-semibold tracking-tight">
              {data.differentiationScore != null ? Math.round(data.differentiationScore) : "—"}
              {data.differentiationScore != null ? (
                <span className="text-muted-foreground text-lg font-medium"> / 100</span>
              ) : null}
            </p>
            <p className="rh-meta mt-1">Seberapa mudah kategori ini dibedakan dari kompetitor.</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Metric label="Kandidat USP">
              {data.uspCandidates.length}
              {stats.topUsp != null ? (
                <span className="text-muted-foreground text-sm font-normal"> (tertinggi {stats.topUsp})</span>
              ) : null}
            </Metric>
            <Metric label="Gap skor 70 ke atas">
              {stats.bigGaps}
              <span className="text-muted-foreground text-sm font-normal"> / {data.gapMatrix.length}</span>
            </Metric>
            <Metric label="Prioritas P0">{stats.p0}</Metric>
            <Metric label="Klaim underserved">{underserved}</Metric>
            <Metric label="Klaim overused">{overused}</Metric>
            <Metric label="Cakupan konteks">{contextQuality.coveragePct}%</Metric>
          </dl>
        </section>

        <Section title="Keputusan kategori">
          {data.categoryDecision && verdict ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <RunStatusBadge
                  tone={verdict.tone}
                  label={`${data.categoryDecision.verdict}: ${verdict.label}`}
                  className="text-sm"
                />
                <span
                  className="rh-meta"
                  title="Estimasi AI, dibatasi cakupan data: verdict dengan konteks modul minim otomatis diturunkan keyakinannya."
                >
                  Keyakinan {Math.round(data.categoryDecision.confidence * 100)}% (estimasi AI)
                </span>
              </div>
              {data.categoryDecision.reason ? (
                <p className="max-w-[68ch] text-sm leading-relaxed">{data.categoryDecision.reason}</p>
              ) : null}
              <AiFeedbackButtons
                module="usp-analyzer"
                artifactType="usp-verdict"
                artifactId={data.id}
                label="Verdict akurat?"
              />
            </div>
          ) : (
            <ResearchPanelEmpty
              title="Belum ada keputusan"
              description="Verdict GO, WATCH, atau AVOID muncul setelah analisis selesai."
            />
          )}
        </Section>
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
              Gap matrix
              {data.gapMatrix.length > 0 ? (
                <span className="text-muted-foreground rh-num ml-1 text-xs">{data.gapMatrix.length}</span>
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
                <span className="text-muted-foreground rh-num ml-1 text-xs">{data.uspCandidates.length}</span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="sumber" className="px-1">
              <Layers className="size-3.5" aria-hidden />
              Sumber
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ringkasan" className={tabContentClass}>
          <Section title="Ringkasan AI">
            {data.aiSummary ? (
              <p className="max-w-[68ch] text-sm leading-relaxed">{data.aiSummary}</p>
            ) : (
              <ResearchPanelEmpty
                icon={Sparkles}
                title="Ringkasan belum tersedia"
                description={
                  inProgress
                    ? "AI masih menyusun ringkasan. Bagian ini terisi otomatis saat analisis selesai."
                    : "Analisis ini tidak menghasilkan ringkasan. Jalankan ulang analisis untuk mencoba lagi."
                }
              />
            )}
          </Section>

          {data.actionPlan ? (
            <Section title="Rencana aksi" meta="Langkah prioritas dari analisis gap.">
              <ActionPlanPanel plan={data.actionPlan} title="Rencana aksi gap (AI)" />
            </Section>
          ) : null}

          <Section
            title="Analisis klaim"
            meta="Klaim yang sudah ramai dipakai kompetitor dan yang masih kosong."
          >
            <ClaimAnalysisPanel data={data.claimAnalysis} />
          </Section>
        </TabsContent>

        <TabsContent value="gap" className={tabContentClass}>
          <Section
            title="Gap matrix"
            meta={
              visibleGapRows.length === data.gapMatrix.length
                ? `${data.gapMatrix.length} klaim, diberi skor peluang dengan bukti dari modul riset.`
                : `${visibleGapRows.length} dari ${data.gapMatrix.length} klaim cocok dengan pencarian.`
            }
            action={
              data.gapMatrix.length > 5 ? (
                <div className="relative w-full sm:w-64">
                  <Search
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    value={gapQuery}
                    onChange={(e) => setGapQuery(e.target.value)}
                    placeholder="Cari klaim atau peluang…"
                    aria-label="Cari klaim atau peluang"
                    className="h-9 pl-8 text-sm"
                  />
                </div>
              ) : null
            }
          >
            {data.gapMatrix.length === 0 ? (
              <ResearchPanelEmpty
                icon={Grid3x3}
                title="Gap matrix masih kosong"
                description={
                  inProgress
                    ? "Matrix terisi setelah AI selesai menganalisis konteks."
                    : "Konteks riset belum cukup untuk memetakan klaim. Tambah sumber data lalu jalankan ulang analisis."
                }
              />
            ) : (
              <div className="border-border bg-card overflow-hidden rounded-xl border">
                <GapMatrixTable rows={visibleGapRows} />
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="positioning" className={tabContentClass}>
          <Section
            title="Positioning map"
            meta={`Sumbu X: ${data.positioningMap.axisX}. Sumbu Y: ${data.positioningMap.axisY}. ${data.positioningMap.points.length} produk dipetakan.`}
          >
            {data.positioningMap.points.length === 0 ? (
              <ResearchPanelEmpty
                icon={Map}
                title="Belum ada produk di peta"
                description="Peta terisi bila analisis menemukan produk kompetitor dari modul riset. Tambahkan sumber produk lalu jalankan ulang."
              />
            ) : (
              <div className="border-border bg-card rounded-xl border p-4">
                <PositioningScatterChart
                  axisX={data.positioningMap.axisX}
                  axisY={data.positioningMap.axisY}
                  points={data.positioningMap.points}
                />
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="usp" className={tabContentClass}>
          <Section
            title="Kandidat USP"
            meta="Tiap kandidat punya alasan percaya (RTB), skor diferensiasi, dan risiko."
          >
            {data.uspCandidates.length === 0 ? (
              <ResearchPanelEmpty
                icon={Target}
                title="Belum ada kandidat USP"
                description={
                  inProgress
                    ? "Kandidat muncul setelah analisis selesai."
                    : "AI tidak menemukan celah yang cukup kuat. Coba kategori yang lebih spesifik atau tambah sumber data."
                }
              />
            ) : (
              <UspCandidateCards
                candidates={data.uspCandidates}
                onCreateBrief={openBrief}
                onCreateConcept={handleCreateConcept}
                briefPending={pending}
                conceptPending={pending}
              />
            )}
          </Section>
        </TabsContent>

        <TabsContent value="sumber" className={tabContentClass}>
          <Section
            title="Sumber data yang dipakai"
            meta="Asal data dari modul riset yang mengisi analisis ini."
          >
            <UspSourcesUsedPanel
              sources={data.resolvedSources}
              matchQuality={data.contextModules.matchQuality}
            />
          </Section>
        </TabsContent>
      </Tabs>

      <UspBriefDialog
        open={briefOpen}
        onOpenChange={setBriefOpen}
        analysisId={data.id}
        category={data.category}
        uspIndex={uspIndex}
        uspText={data.uspCandidates[uspIndex]?.usp ?? null}
        rooms={data.rooms}
      />
    </ResearchHubDetailPage>
  );
}

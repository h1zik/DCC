"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  FlaskConical,
  GitCompare,
  PenLine,
  Send,
  ShieldCheck,
} from "lucide-react";
import { ProductConceptStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  archiveProductConcept,
  sendConceptToRdTask,
  updateProductConcept,
  validateProductConcept,
} from "@/actions/research-concept-lab";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ConceptPdfDownloadButton } from "@/components/research-hub/concept-pdf-download-button";
import { JobProgressBar } from "@/components/research-hub/job-progress-bar";
import { ConceptRiskFactorList } from "@/components/research-hub/concept-risk-factors";
import {
  ConceptStepForm,
  type ConceptFormData,
} from "@/components/research-hub/concept-step-form";
import {
  ConceptValidationPanel,
  type ConceptValidationData,
} from "@/components/research-hub/concept-validation-panel";
import { ResearchHubDetailPage } from "@/components/research-hub/research-hub-module-page";
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
import { PRODUCT_CONCEPT_STATUS_LABELS } from "@/lib/research/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { lab } from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";

export type ConceptDetailData = {
  id: string;
  title: string;
  category: string;
  targetMarket: string | null;
  status: ProductConceptStatus;
  conceptData: ConceptFormData;
  validationScores: ConceptValidationData;
  riskFactors: {
    label: string;
    severity: "HIGH" | "MED" | "LOW";
    source: { module: string; label: string; href?: string };
  }[];
  uspGapAnalysisId: string | null;
  rooms: {
    id: string;
    name: string;
    brandId: string | null;
  }[];
  otherConcepts: { id: string; title: string }[];
  aiMeta: ResearchAiMetaView | null;
};

const PILL_CLASS =
  "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold";

function statusPillTone(status: ProductConceptStatus): string {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "SENT_TO_RND":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300";
    case "VALIDATING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

const DECISION_TONE: Record<string, string> = {
  GO: "text-emerald-600 dark:text-emerald-400",
  PIVOT: "text-amber-600 dark:text-amber-400",
  NO_GO: "text-rose-600 dark:text-rose-400",
};

const tabContentClass =
  "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-6 duration-200 motion-reduce:animate-none pt-4";

export function ConceptDetailClient({ data }: { data: ConceptDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formData, setFormData] = useState(data.conceptData);
  const [rdOpen, setRdOpen] = useState(false);
  const [roomId, setRoomId] = useState(data.rooms[0]?.id ?? "");
  const [projectName, setProjectName] = useState(`R&D: ${data.title}`);
  const [compareId, setCompareId] = useState("");

  const inProgress = data.status === "VALIDATING";
  const selectedRoom = data.rooms.find((r) => r.id === roomId);
  const validated = data.validationScores.overall > 0;
  const highRiskCount = data.riskFactors.filter(
    (r) => r.severity === "HIGH",
  ).length;

  const roomItems = useMemo(
    (): SelectItemDef[] =>
      data.rooms.map((r) => ({ value: r.id, label: r.name })),
    [data.rooms],
  );

  const compareItems = useMemo(
    (): SelectItemDef[] =>
      data.otherConcepts.map((c) => ({ value: c.id, label: c.title })),
    [data.otherConcepts],
  );

  const needsRevalidate =
    data.status === "DRAFT" && data.validationScores.overall > 0;

  useEffect(() => {
    if (!inProgress) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [inProgress, router]);

  function handleSave() {
    startTransition(async () => {
      try {
        await updateProductConcept({ id: data.id, conceptData: formData });
        toast.success("Konsep disimpan.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan."));
      }
    });
  }

  function handleValidate() {
    startTransition(async () => {
      try {
        await validateProductConcept(data.id);
        toast.success("Validasi selesai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal validasi."));
      }
    });
  }

  function handleArchive() {
    startTransition(async () => {
      try {
        await archiveProductConcept(data.id);
        toast.success("Konsep diarsipkan.");
        router.push("/research-hub/concept-lab");
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengarsipkan."));
      }
    });
  }

  function handleRd() {
    if (!selectedRoom?.brandId) {
      toast.error("Pilih room dengan brand.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await sendConceptToRdTask({
          conceptId: data.id,
          roomId,
          brandId: selectedRoom.brandId!,
          projectName,
        });
        toast.success("Task R&D dibuat.");
        setRdOpen(false);
        router.push(`/projects/${result.projectId}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat task."));
      }
    });
  }

  function handleCompare() {
    if (!compareId) {
      toast.error("Pilih konsep pembanding.");
      return;
    }
    router.push(
      `/research-hub/concept-lab/compare?ids=${data.id},${compareId}`,
    );
  }

  return (
    <ResearchHubDetailPage
      icon={FlaskConical}
      backHref="/research-hub/concept-lab"
      title={data.title}
      description={`${data.category}${data.targetMarket ? ` · ${data.targetMarket}` : ""}`}
      right={
        <>
          <ResearchModelBadgeGroup meta={data.aiMeta} />
          <span className={cn(PILL_CLASS, statusPillTone(data.status))}>
            {PRODUCT_CONCEPT_STATUS_LABELS[data.status]}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={pending}
          >
            Simpan
          </Button>
          <Button size="sm" onClick={handleValidate} disabled={pending}>
            Validasi
          </Button>
          <ConceptPdfDownloadButton conceptId={data.id} title={data.title} />
          <Dialog open={rdOpen} onOpenChange={setRdOpen}>
            <DialogTrigger
              render={
                <Button size="sm" variant="outline">
                  <Send className="mr-1.5 size-3.5" aria-hidden />
                  Kirim ke R&D
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Kirim ke Task R&D</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
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
                <Button onClick={handleRd} disabled={pending}>
                  Buat Task R&D
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      }
    >
      {inProgress ? (
        <div className={lab.entrance}>
          <JobProgressBar
            title="Memvalidasi konsep dengan AI"
            percent={70}
            stepLabel="AI menilai demand, diferensiasi, pricing & risiko — skor disesuaikan dengan data kompetitor bila tersedia."
          />
        </div>
      ) : null}

      {needsRevalidate ? (
        <p
          className={cn(
            lab.entrance,
            "flex items-start gap-2.5 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100",
          )}
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Konsep diubah sejak validasi terakhir — jalankan Validasi ulang
          sebelum export R&D.
        </p>
      ) : null}

      {/* Papan hero bento: skor validasi */}
      {validated ? (
        <div
          className={cn(
            lab.entrance,
            "grid grid-flow-row-dense auto-rows-[6.75rem] grid-cols-2 gap-3 lg:grid-cols-4",
          )}
        >
          <div className="bento-tile row-span-2 border-transparent bg-violet-600 shadow-md shadow-violet-600/20 dark:bg-violet-500">
            <span className="text-[11.5px] font-semibold text-violet-100 dark:text-violet-950/70">
              Skor keseluruhan
            </span>
            <span className="bento-value text-5xl text-white dark:text-violet-950">
              {Math.round(data.validationScores.overall)}
              <span className="text-2xl font-bold text-violet-200/80 dark:text-violet-900/60">
                /100
              </span>
            </span>
            <span className="text-xs font-medium leading-snug text-violet-100/90 dark:text-violet-900/80">
              gabungan demand, diferensiasi & pricing fit
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Market demand</span>
            <span className="bento-value">
              {Math.round(data.validationScores.marketDemand)}
              <span className="text-muted-foreground/60 text-lg font-bold">
                /100
              </span>
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Differentiation</span>
            <span className="bento-value">
              {Math.round(data.validationScores.differentiation)}
              <span className="text-muted-foreground/60 text-lg font-bold">
                /100
              </span>
            </span>
          </div>

          <div className="bento-tile">
            <span className="bento-label">Pricing fit</span>
            <span className="bento-value">
              {Math.round(data.validationScores.pricingFit)}
              <span className="text-muted-foreground/60 text-lg font-bold">
                /100
              </span>
            </span>
          </div>

          <div className="bento-tile border-transparent bg-[#e9e3f9] dark:bg-violet-400/10">
            <span className="text-[11.5px] font-semibold text-violet-700/70 dark:text-violet-300/70">
              Keputusan
            </span>
            <span
              className={cn(
                "bento-value",
                DECISION_TONE[data.validationScores.decision ?? ""] ??
                  "text-violet-900 dark:text-violet-300",
              )}
            >
              {data.validationScores.decision ?? "—"}
            </span>
          </div>

          <div
            className={cn(
              "bento-tile",
              data.riskFactors.length > 0
                ? "border-transparent bg-[#fbdcd7] dark:bg-rose-400/10"
                : undefined,
            )}
          >
            <span
              className={cn(
                data.riskFactors.length > 0
                  ? "text-[11.5px] font-semibold text-rose-800/70 dark:text-rose-200/60"
                  : "bento-label",
              )}
            >
              Faktor risiko
            </span>
            <span
              className={cn(
                "bento-value",
                data.riskFactors.length > 0 &&
                  "text-rose-900 dark:text-rose-300",
              )}
            >
              {data.riskFactors.length}
            </span>
            <span
              className={cn(
                "text-[11px] font-medium",
                data.riskFactors.length > 0
                  ? "text-rose-800/70 dark:text-rose-200/60"
                  : "text-muted-foreground",
              )}
            >
              {highRiskCount > 0
                ? `${highRiskCount} keparahan tinggi`
                : "dari riset pasar"}
            </span>
          </div>
        </div>
      ) : null}

      {data.uspGapAnalysisId ? (
        <div className={cn(lab.entrance, "-mt-2")}>
          <Link
            href={`/research-hub/usp-analyzer/${data.uspGapAnalysisId}`}
            className="text-primary text-xs font-semibold hover:underline"
          >
            Lihat USP & Gap Analysis sumber →
          </Link>
        </div>
      ) : null}

      <Tabs defaultValue="validasi" className="gap-0">
        <div className={cn(lab.stickyToolbar, "pb-0")}>
          <TabsList variant="line" className="h-9 w-full justify-start gap-4">
            <TabsTrigger value="validasi" className="px-1">
              <ShieldCheck className="size-3.5" aria-hidden />
              Validasi
            </TabsTrigger>
            <TabsTrigger value="konsep" className="px-1">
              <PenLine className="size-3.5" aria-hidden />
              Konsep
            </TabsTrigger>
            <TabsTrigger value="risiko" className="px-1">
              <AlertTriangle className="size-3.5" aria-hidden />
              Risiko
              {data.riskFactors.length > 0 ? (
                <span className="text-muted-foreground ml-1 text-[10px] tabular-nums">
                  {data.riskFactors.length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="bandingkan" className="px-1">
              <GitCompare className="size-3.5" aria-hidden />
              Bandingkan
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="validasi" className={tabContentClass}>
          <div className="bento-tile justify-start gap-3">
            <div className="flex items-center justify-between">
              <span className="bento-label">Concept Validator</span>
              <span className="text-muted-foreground text-[11px]">
                skor disesuaikan data kompetitor & cakupan riset
              </span>
            </div>
            <ConceptValidationPanel
              data={data.validationScores}
              conceptId={data.id}
            />
          </div>
        </TabsContent>

        <TabsContent value="konsep" className={tabContentClass}>
          <div className="bento-tile justify-start gap-3">
            <div className="flex items-center justify-between">
              <span className="bento-label">Concept Builder</span>
              <span className="text-muted-foreground text-[11px]">
                positioning, ingredients, claims & packaging
              </span>
            </div>
            <ConceptStepForm data={formData} onChange={setFormData} />
          </div>
        </TabsContent>

        <TabsContent value="risiko" className={tabContentClass}>
          <div className="bento-tile justify-start gap-3">
            <div className="flex items-center justify-between">
              <span className="bento-label">
                Faktor risiko dari riset pasar
              </span>
              <span className="text-muted-foreground text-[11px]">
                terhubung ke modul sumber — bukan tebakan AI semata
              </span>
            </div>
            {data.riskFactors.length > 0 ? (
              <ConceptRiskFactorList items={data.riskFactors} />
            ) : (
              <p className="text-muted-foreground text-sm">
                Belum ada faktor risiko — jalankan validasi setelah data
                review/social tersedia.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bandingkan" className={tabContentClass}>
          <div className="bento-tile justify-start gap-3">
            <span className="bento-label">Bandingkan konsep</span>
            <p className="text-muted-foreground text-sm">
              Head-to-head dengan konsep lain di Concept Lab.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1 space-y-2">
                <Label>Konsep pembanding</Label>
                <Select
                  value={compareId}
                  items={compareItems}
                  onValueChange={(v) => v && setCompareId(v)}
                >
                  <SelectTrigger />
                  <SelectContent>
                    {data.otherConcepts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={handleCompare} disabled={!compareId}>
                Bandingkan
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleArchive}
                disabled={pending}
              >
                Arsipkan
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </ResearchHubDetailPage>
  );
}

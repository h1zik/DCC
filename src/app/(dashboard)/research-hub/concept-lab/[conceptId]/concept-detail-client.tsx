"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
import {
  hub,
  ResearchHubPageHeader,
  ResearchHubSection,
  ResearchHubStatChip,
} from "@/components/research-hub/research-hub-primitives";
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

function statusChipTone(
  status: ProductConceptStatus,
): "neutral" | "success" | "warning" | "primary" {
  switch (status) {
    case "READY":
      return "success";
    case "VALIDATING":
      return "warning";
    case "ARCHIVED":
      return "neutral";
    default:
      return "neutral";
  }
}

function decisionChipTone(
  decision?: string,
): "neutral" | "success" | "warning" | "primary" {
  switch (decision) {
    case "GO":
      return "success";
    case "NO_GO":
      return "warning";
    case "PIVOT":
      return "primary";
    default:
      return "neutral";
  }
}

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
    <div className="flex flex-col gap-6 pb-6">
      <Link
        href="/research-hub/concept-lab"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-xs transition-colors duration-150 motion-reduce:transition-none"
      >
        <FlaskConical className="size-3" aria-hidden />
        Kembali ke Concept Lab
      </Link>

      <ResearchHubPageHeader
        variant="detail"
        icon={FlaskConical}
        eyebrow="Product Concept Lab"
        title={data.title}
        description={`${data.category}${data.targetMarket ? ` · ${data.targetMarket}` : ""}`}
        right={
          <>
            <ResearchModelBadgeGroup meta={data.aiMeta} />
            <Button size="sm" variant="outline" onClick={handleSave} disabled={pending}>
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
                  <Button onClick={handleRd} disabled={pending}>
                    Buat Task R&D
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <ResearchHubStatChip
              label="Status"
              value={PRODUCT_CONCEPT_STATUS_LABELS[data.status]}
              tone={statusChipTone(data.status)}
            />
            <ResearchHubStatChip
              label="Overall"
              value={
                data.validationScores.overall > 0
                  ? Math.round(data.validationScores.overall).toLocaleString("id-ID")
                  : "—"
              }
              tone="primary"
            />
            {data.validationScores.decision ? (
              <ResearchHubStatChip
                label="Keputusan"
                value={data.validationScores.decision}
                tone={decisionChipTone(data.validationScores.decision)}
              />
            ) : null}
            {data.riskFactors.length > 0 ? (
              <ResearchHubStatChip
                label="Risiko"
                value={data.riskFactors.length.toLocaleString("id-ID")}
                tone={
                  data.riskFactors.some((r) => r.severity === "HIGH")
                    ? "warning"
                    : "neutral"
                }
              />
            ) : null}
            {data.uspGapAnalysisId ? (
              <Link
                href={`/research-hub/usp-analyzer/${data.uspGapAnalysisId}`}
                className="text-primary text-xs hover:underline"
              >
                Lihat USP sumber →
              </Link>
            ) : null}
          </div>
        }
      />

      {inProgress ? (
        <div className={hub.entrance}>
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
            hub.nestedPanel,
            "flex items-start gap-2 border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100 text-sm",
          )}
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Konsep diubah sejak validasi terakhir — jalankan Validasi ulang sebelum export R&D.
        </p>
      ) : null}

      <Tabs defaultValue="validasi" className="gap-0">
        <div className={cn(hub.stickyToolbar, "pb-0")}>
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
          <ResearchHubSection
            title="Concept Validator"
            description="Skor demand, diferensiasi, pricing — disesuaikan dengan data kompetitor & cakupan riset."
          >
            <div className={hub.panel}>
              <ConceptValidationPanel data={data.validationScores} />
            </div>
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="konsep" className={tabContentClass}>
          <ResearchHubSection
            title="Concept Builder"
            description="Edit positioning, ingredients, claims, dan packaging direction."
          >
            <div className={hub.panel}>
              <ConceptStepForm data={formData} onChange={setFormData} />
            </div>
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="risiko" className={tabContentClass}>
          <ResearchHubSection
            title="Faktor Risiko dari Riset Pasar"
            description="Risiko terhubung ke modul sumber — bukan tebakan AI semata."
          >
            {data.riskFactors.length > 0 ? (
              <div className={hub.panel}>
                <ConceptRiskFactorList items={data.riskFactors} />
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Belum ada faktor risiko — jalankan validasi setelah data review/social tersedia.
              </p>
            )}
          </ResearchHubSection>
        </TabsContent>

        <TabsContent value="bandingkan" className={tabContentClass}>
          <ResearchHubSection
            title="Bandingkan Konsep"
            description="Head-to-head dengan konsep lain di Concept Lab."
          >
            <div className={cn(hub.panel, "flex flex-wrap items-end gap-2")}>
              <div className="min-w-[200px] flex-1 space-y-2">
                <Label>Konsep pembanding</Label>
                <Select value={compareId} onValueChange={(v) => v && setCompareId(v)}>
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
              <Button size="sm" variant="ghost" onClick={handleArchive} disabled={pending}>
                Arsipkan
              </Button>
            </div>
          </ResearchHubSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}

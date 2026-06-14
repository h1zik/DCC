"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, Send } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PRODUCT_CONCEPT_STATUS_LABELS } from "@/lib/research/labels";
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
  rooms: {
    id: string;
    name: string;
    brandId: string | null;
  }[];
  otherConcepts: { id: string; title: string }[];
  aiMeta: ResearchAiMetaView | null;
};

function statusTone(status: ProductConceptStatus) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "VALIDATING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "ARCHIVED":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

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
    <div className="space-y-6">
      <ResearchModelBadgeGroup meta={data.aiMeta} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/research-hub/concept-lab"
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="size-3" /> Kembali
          </Link>
          <h1 className="text-xl font-semibold">{data.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {data.category}
            {data.targetMarket ? ` · ${data.targetMarket}` : ""}
          </p>
          <span
            className={cn(
              "mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
              statusTone(data.status),
            )}
          >
            {PRODUCT_CONCEPT_STATUS_LABELS[data.status]}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
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
                  <Send className="mr-1.5 size-3.5" />
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
        </div>
      </div>

      {inProgress ? (
        <JobProgressBar
          title="Memvalidasi konsep dengan AI"
          percent={70}
          stepLabel="AI sedang menilai demand, diferensiasi, pricing & risiko — halaman refresh otomatis."
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Concept Validator</CardTitle>
        </CardHeader>
        <CardContent>
          <ConceptValidationPanel data={data.validationScores} />
        </CardContent>
      </Card>

      {data.riskFactors.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Faktor Risiko dari Riset Pasar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ConceptRiskFactorList items={data.riskFactors} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Concept Builder</CardTitle>
        </CardHeader>
        <CardContent>
          <ConceptStepForm data={formData} onChange={setFormData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bandingkan Konsep</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
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
        </CardContent>
      </Card>
    </div>
  );
}

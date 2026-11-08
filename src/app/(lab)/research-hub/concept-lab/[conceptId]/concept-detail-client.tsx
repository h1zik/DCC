"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Archive,
  FlaskConical,
  GitCompare,
  Loader2,
  PenLine,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react";
import { ProductConceptStatus } from "@prisma/client";
import { toast } from "sonner";
import {
  archiveProductConcept,
  updateProductConcept,
  validateProductConcept,
} from "@/actions/research-concept-lab";
import { actionErrorMessage } from "@/lib/action-error-message";
import { ConceptPdfDownloadButton } from "@/components/research-hub/concept-pdf-download-button";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PRODUCT_CONCEPT_STATUS_LABELS } from "@/lib/research/labels";
import type { SelectItemDef } from "@/lib/select-option-items";
import { lab } from "@/components/lab/lab-primitives";
import { RunStatusBadge, type RunTone } from "@/components/research-hub/kit/run-status";
import { ResearchPanelEmpty } from "@/components/research-hub/kit/research-states";
import { cn } from "@/lib/utils";
import type { ResearchAiMetaView } from "@/lib/research/research-module-models";
import { ResearchModelBadgeGroup } from "@/components/research-hub/research-model-badge";
import { SendToRdDialog } from "./send-to-rd-dialog";

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

function toneOf(status: ProductConceptStatus): RunTone {
  if (status === "READY" || status === "SENT_TO_RND") return "ready";
  if (status === "VALIDATING") return "running";
  return "idle";
}

const DECISION_META: Record<string, { label: string; className: string }> = {
  GO: { label: "GO", className: "text-emerald-700 dark:text-emerald-300" },
  PIVOT: { label: "Pivot", className: "text-amber-700 dark:text-amber-300" },
  NO_GO: { label: "NO GO", className: "text-rose-700 dark:text-rose-300" },
};

const tabContentClass =
  "animate-in fade-in duration-200 motion-reduce:animate-none flex flex-col gap-8 pt-5";

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="space-y-0.5">
        <h2 className="rh-section-title">{title}</h2>
        {meta ? <p className="rh-meta">{meta}</p> : null}
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

function OutOf100({ value }: { value: number }) {
  return (
    <>
      {Math.round(value)}
      <span className="text-muted-foreground text-sm font-normal"> / 100</span>
    </>
  );
}

export function ConceptDetailClient({ data }: { data: ConceptDetailData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formData, setFormData] = useState(data.conceptData);
  const [rdOpen, setRdOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [compareId, setCompareId] = useState("");

  const tone = toneOf(data.status);
  const inProgress = data.status === "VALIDATING";
  const validated = data.validationScores.overall > 0;
  const highRiskCount = data.riskFactors.filter((r) => r.severity === "HIGH").length;
  const decision = data.validationScores.decision
    ? DECISION_META[data.validationScores.decision]
    : null;

  const compareItems = useMemo(
    (): SelectItemDef[] => data.otherConcepts.map((c) => ({ value: c.id, label: c.title })),
    [data.otherConcepts],
  );

  const needsRevalidate = data.status === "DRAFT" && data.validationScores.overall > 0;

  useEffect(() => {
    if (!inProgress) return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") router.refresh(); }, 12_000);
    return () => window.clearInterval(id);
  }, [inProgress, router]);

  function handleSave() {
    startTransition(async () => {
      try {
        await updateProductConcept({ id: data.id, conceptData: formData });
        toast.success("Konsep disimpan.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Konsep gagal disimpan."));
      }
    });
  }

  function handleValidate() {
    startTransition(async () => {
      try {
        await validateProductConcept(data.id);
        toast.success("Konsep divalidasi.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Validasi gagal. Simpan konsep lalu coba lagi."));
      }
    });
  }

  function handleArchive() {
    startTransition(async () => {
      try {
        await archiveProductConcept(data.id);
        toast.success(`"${data.title}" diarsipkan.`);
        setArchiveOpen(false);
        router.push("/research-hub/concept-lab");
      } catch (err) {
        toast.error(actionErrorMessage(err, "Konsep gagal diarsipkan."));
      }
    });
  }

  function handleCompare() {
    if (!compareId) {
      toast.error("Pilih konsep pembanding dulu.");
      return;
    }
    router.push(`/research-hub/concept-lab/compare?ids=${data.id},${compareId}`);
  }

  return (
    <ResearchHubDetailPage
      icon={FlaskConical}
      backHref="/research-hub/concept-lab"
      title={data.title}
      meta={
        <>
          <RunStatusBadge tone={tone} label={PRODUCT_CONCEPT_STATUS_LABELS[data.status]} />
          <span>Kategori: {data.category}</span>
          {data.targetMarket ? <span>Target: {data.targetMarket}</span> : null}
          {data.uspGapAnalysisId ? (
            <Link
              href={`/research-hub/usp-analyzer/${data.uspGapAnalysisId}`}
              className="text-primary focus-visible:ring-ring rounded font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              Lihat analisis USP sumber
            </Link>
          ) : null}
          <ResearchModelBadgeGroup meta={data.aiMeta} />
        </>
      }
      right={
        <>
          <Button size="sm" variant="outline" onClick={handleSave} disabled={pending}>
            <Save aria-hidden />
            Simpan konsep
          </Button>
          <Button size="sm" onClick={handleValidate} disabled={pending || inProgress}>
            <ShieldCheck aria-hidden />
            {validated ? "Validasi ulang" : "Validasi"}
          </Button>
          <ConceptPdfDownloadButton conceptId={data.id} title={data.title} />
          <Button size="sm" variant="outline" onClick={() => setRdOpen(true)}>
            <Send aria-hidden />
            Kirim ke R&D
          </Button>
          {data.status !== "ARCHIVED" ? (
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setArchiveOpen(true)}
              disabled={pending}
              aria-label={`Arsipkan "${data.title}"`}
              title="Arsipkan"
            >
              <Archive aria-hidden />
            </Button>
          ) : null}
        </>
      }
    >
      {inProgress ? (
        <div
          className="border-border bg-muted/30 flex items-start gap-3 rounded-xl border px-4 py-3"
          aria-live="polite"
        >
          <Loader2 className="text-muted-foreground mt-0.5 size-4 shrink-0 motion-safe:animate-spin" aria-hidden />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">AI sedang memvalidasi konsep</p>
            <p className="rh-meta">
              Demand, diferensiasi, pricing, dan risiko dinilai dengan data kompetitor bila tersedia.
              Halaman ini diperbarui otomatis.
            </p>
          </div>
        </div>
      ) : null}

      {needsRevalidate ? (
        <p
          className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
          role="status"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Konsep diubah sejak validasi terakhir. Klik Validasi ulang sebelum mengirim ke R&D.
        </p>
      ) : null}

      {validated ? (
        <section aria-labelledby="concept-score-title" className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-12">
          <div>
            <h2 id="concept-score-title" className="rh-meta">Skor keseluruhan</h2>
            <p className="rh-num text-foreground mt-1 text-4xl font-semibold tracking-tight">
              {Math.round(data.validationScores.overall)}
              <span className="text-muted-foreground text-lg font-medium"> / 100</span>
            </p>
            <p className="rh-meta mt-1">Gabungan demand, diferensiasi, dan pricing fit.</p>
          </div>
          <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label="Market demand">
              <OutOf100 value={data.validationScores.marketDemand} />
            </Metric>
            <Metric label="Diferensiasi">
              <OutOf100 value={data.validationScores.differentiation} />
            </Metric>
            <Metric label="Pricing fit">
              <OutOf100 value={data.validationScores.pricingFit} />
            </Metric>
            <Metric label="Keputusan">
              <span className={decision?.className}>{decision?.label ?? "—"}</span>
            </Metric>
            <Metric label="Faktor risiko">
              {data.riskFactors.length}
              {highRiskCount > 0 ? (
                <span className="text-sm font-normal text-rose-700 dark:text-rose-300"> ({highRiskCount} tinggi)</span>
              ) : null}
            </Metric>
          </dl>
        </section>
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
                <span className="text-muted-foreground rh-num ml-1 text-xs">{data.riskFactors.length}</span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="bandingkan" className="px-1">
              <GitCompare className="size-3.5" aria-hidden />
              Bandingkan
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="validasi" className={tabContentClass}>
          <Section
            title="Hasil validasi"
            meta="Skor disesuaikan dengan data kompetitor dan cakupan riset yang tersedia."
          >
            {validated ? (
              <ConceptValidationPanel data={data.validationScores} conceptId={data.id} />
            ) : (
              <ResearchPanelEmpty
                icon={ShieldCheck}
                title="Konsep belum divalidasi"
                description={
                  inProgress
                    ? "Validasi sedang berjalan. Hasilnya muncul di sini otomatis."
                    : "Lengkapi isi konsep di tab Konsep, simpan, lalu klik Validasi untuk mendapat skor dan keputusan."
                }
                action={
                  inProgress ? null : (
                    <Button size="sm" onClick={handleValidate} disabled={pending}>
                      <ShieldCheck aria-hidden />
                      Validasi
                    </Button>
                  )
                }
              />
            )}
          </Section>
        </TabsContent>

        <TabsContent value="konsep" className={tabContentClass}>
          <Section
            title="Isi konsep"
            meta="Positioning, bahan utama, klaim, dan arah kemasan. Klik Simpan konsep setelah mengubah."
          >
            <ConceptStepForm data={formData} onChange={setFormData} />
          </Section>
        </TabsContent>

        <TabsContent value="risiko" className={tabContentClass}>
          <Section
            title="Faktor risiko dari riset pasar"
            meta="Tiap risiko terhubung ke modul sumbernya, bukan tebakan AI semata."
          >
            {data.riskFactors.length > 0 ? (
              <ConceptRiskFactorList items={data.riskFactors} />
            ) : (
              <ResearchPanelEmpty
                icon={AlertTriangle}
                title="Belum ada faktor risiko"
                description="Risiko diambil dari Review Intelligence dan Social Listening. Jalankan validasi setelah data review atau social tersedia."
              />
            )}
          </Section>
        </TabsContent>

        <TabsContent value="bandingkan" className={tabContentClass}>
          <Section title="Bandingkan konsep" meta="Adu langsung dengan konsep lain di Concept Lab.">
            {data.otherConcepts.length === 0 ? (
              <ResearchPanelEmpty
                icon={GitCompare}
                title="Belum ada konsep pembanding"
                description="Buat minimal satu konsep lain yang belum diarsipkan untuk membandingkan."
              />
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid min-w-[200px] flex-1 gap-1.5 sm:max-w-sm">
                  <Label htmlFor="concept-compare-target">Konsep pembanding</Label>
                  <Select
                    value={compareId}
                    items={compareItems}
                    onValueChange={(v) => v && setCompareId(v)}
                  >
                    <SelectTrigger id="concept-compare-target" />
                    <SelectContent>
                      {data.otherConcepts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCompare} disabled={!compareId}>
                  <GitCompare aria-hidden />
                  Bandingkan
                </Button>
              </div>
            )}
          </Section>
        </TabsContent>
      </Tabs>

      <SendToRdDialog
        open={rdOpen}
        onOpenChange={setRdOpen}
        conceptId={data.id}
        conceptTitle={data.title}
        rooms={data.rooms}
      />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Arsipkan "${data.title}"?`}
        description="Konsep disembunyikan dari daftar dan tidak bisa dipilih sebagai pembanding. Isi dan skornya tetap tersimpan; tampilkan lagi lewat filter arsip."
        confirmLabel="Arsipkan konsep"
        pending={pending}
        onConfirm={handleArchive}
      />
    </ResearchHubDetailPage>
  );
}

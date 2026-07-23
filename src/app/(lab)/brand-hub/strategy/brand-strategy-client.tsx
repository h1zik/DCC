"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Compass, Loader2, PenLine, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createBrandStrategyDocument,
  createManualBrandStrategyDocument,
  deleteBrandStrategyDocument,
  exportBrandStrategyPdfBase64,
  regenerateBrandStrategyDocument,
  regenerateBrandStrategySectionAction,
  updateBrandStrategyDocument,
} from "@/actions/brand-strategy";
import { actionErrorMessage } from "@/lib/action-error-message";
import { BrandEvidencePanel } from "@/components/brand-hub/brand-evidence-panel";
import { BrandStrategyRationalePanel } from "@/components/brand-hub/brand-strategy-rationale-panel";
import { BrandStrategySourcePicker } from "@/components/brand-hub/brand-strategy-source-picker";
import { BrandPdfExportButton } from "@/components/brand-hub/brand-pdf-export-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { useBrandStudioGenerationPoll } from "../use-brand-studio-generation-poll";
import type { ProductLineStrategy } from "@/lib/brand-research/portfolio/types";
import type {
  EvidenceReadiness,
  StrategicTension,
  StrategySectionField,
  StrategyGenerationConfig,
  StrategySourceCatalog,
} from "@/lib/brand-research/strategy/evidence-types";
import {
  LabDocumentSidebar,
  LabEmptyState,
  lab,
} from "@/components/lab/lab-primitives";
import { normalizeStrategyGenerationConfig } from "@/lib/brand-research/strategy/strategy-visual-config";
import { ActionPlanPanel } from "@/components/research-hub/action-plan-panel";
import { cn } from "@/lib/utils";

type Stp = {
  segment?: string;
  targeting?: string;
  positioningStatement?: string;
};

type Personality = {
  archetype?: string;
  traits?: string[];
  antiTraits?: string[];
};

type Tone = {
  principles?: string[];
  doExamples?: string[];
  dontExamples?: string[];
};

export type StrategyDocumentView = {
  id: string;
  status: string;
  version: number;
  ownerBrandId: string | null;
  category: string | null;
  pmBrief: string | null;
  brandPurpose: string | null;
  brandEssence: string | null;
  coreMessage: string | null;
  brandUsp: string | null;
  stp: Stp | null;
  brandPersonality: Personality | null;
  toneOfVoice: Tone | null;
  strategicTensions?: StrategicTension[] | null;
  productLineStrategy?: ProductLineStrategy[] | null;
  insightMemo?: unknown;
  actionPlan?: unknown;
  citationQuality?: {
    score?: number;
    passed?: boolean;
    validRefs?: number;
    totalRefs?: number;
  } | null;
  evidenceRefs: unknown;
  strategyRationales?: unknown;
  generationConfig?: unknown;
  evidenceSnapshot?: unknown;
  errorMessage: string | null;
  updatedAt: string;
};

/** Dokumen yang dibuat lewat "Input manual" — tanpa jejak AI (evidence & config kosong). */
function isManualStrategyDoc(doc: StrategyDocumentView): boolean {
  const refs = Array.isArray(doc.evidenceRefs) ? doc.evidenceRefs : [];
  const cfg =
    doc.generationConfig && typeof doc.generationConfig === "object"
      ? (doc.generationConfig as Record<string, unknown>)
      : {};
  return refs.length === 0 && Object.keys(cfg).length === 0;
}

function parseLines(s: string): string[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function linesJoin(arr: string[] | undefined): string {
  return arr?.join("\n") ?? "";
}

const DOC_STATUS_META: Record<
  string,
  { label: string; pill: string; dot: string }
> = {
  READY: {
    label: "Siap",
    pill: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  GENERATING: {
    label: "Generating",
    pill: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500 animate-pulse",
  },
  DRAFT: {
    label: "Draft",
    pill: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
  FAILED: {
    label: "Gagal",
    pill: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

function docStatusMeta(status: string) {
  return DOC_STATUS_META[status] ?? DOC_STATUS_META.DRAFT;
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BrandStrategyClient({
  documents,
  evidenceReadiness,
  sourceCatalog,
  defaultGenerationConfig,
  defaultBrandId,
}: {
  documents: StrategyDocumentView[];
  evidenceReadiness: EvidenceReadiness;
  sourceCatalog: StrategySourceCatalog;
  defaultGenerationConfig: StrategyGenerationConfig;
  defaultBrandId?: string | null;
}) {
  const router = useRouter();
  const brandId = useBrandHubBrandId(defaultBrandId);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeMode, setComposeMode] = useState(false);
  const [generationConfig, setGenerationConfig] =
    useState<StrategyGenerationConfig>(defaultGenerationConfig);

  const selected = documents.find((d) => d.id === selectedId) ?? null;
  const showWorkspace = composeMode || selectedId !== null;
  const isGenerating = selected?.status === "GENERATING";
  const canGenerate = evidenceReadiness.canGenerate;

  const [brandPurpose, setBrandPurpose] = useState("");
  const [brandEssence, setBrandEssence] = useState("");
  const [coreMessage, setCoreMessage] = useState("");
  const [brandUsp, setBrandUsp] = useState("");
  const [stpSegment, setStpSegment] = useState("");
  const [stpTargeting, setStpTargeting] = useState("");
  const [stpPositioning, setStpPositioning] = useState("");
  const [archetype, setArchetype] = useState("");
  const [traits, setTraits] = useState("");
  const [antiTraits, setAntiTraits] = useState("");
  const [tonePrinciples, setTonePrinciples] = useState("");
  const [toneDo, setToneDo] = useState("");
  const [toneDont, setToneDont] = useState("");
  const [category, setCategory] = useState("");
  const [pmBrief, setPmBrief] = useState("");
  const [sectionPending, setSectionPending] = useState<StrategySectionField | null>(null);

  // Efek sinkronisasi state form ↔ dokumen terpilih di bawah ini adalah pola
  // bawaan modul (form editable di-seed dari data server saat seleksi
  // berubah); dibiarkan apa adanya agar alur data tidak berubah.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGenerationConfig(defaultGenerationConfig);
  }, [defaultGenerationConfig]);

  useEffect(() => {
    if (!selected?.generationConfig) return;
    const saved = selected.generationConfig as StrategyGenerationConfig;
    if (saved.review) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGenerationConfig(normalizeStrategyGenerationConfig(saved, sourceCatalog));
    }
  }, [selected?.id, selected?.generationConfig, sourceCatalog]);

  useEffect(() => {
    if (!selected) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrandPurpose(selected.brandPurpose ?? "");
    setBrandEssence(selected.brandEssence ?? "");
    setCoreMessage(selected.coreMessage ?? "");
    setBrandUsp(selected.brandUsp ?? "");
    setStpSegment(selected.stp?.segment ?? "");
    setStpTargeting(selected.stp?.targeting ?? "");
    setStpPositioning(selected.stp?.positioningStatement ?? "");
    setArchetype(selected.brandPersonality?.archetype ?? "");
    setTraits(linesJoin(selected.brandPersonality?.traits));
    setAntiTraits(linesJoin(selected.brandPersonality?.antiTraits));
    setTonePrinciples(linesJoin(selected.toneOfVoice?.principles));
    setToneDo(linesJoin(selected.toneOfVoice?.doExamples));
    setToneDont(linesJoin(selected.toneOfVoice?.dontExamples));
  }, [selected]);

  useBrandStudioGenerationPoll({
    active: isGenerating,
    selectedId,
    brandId,
  });

  useEffect(() => {
    if (selectedId && !documents.some((d) => d.id === selectedId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(null);
      setComposeMode(false);
    }
  }, [documents, selectedId]);

  function startCompose() {
    setSelectedId(null);
    setComposeMode(true);
    setCategory("");
    setPmBrief("");
    setGenerationConfig(
      normalizeStrategyGenerationConfig(defaultGenerationConfig, sourceCatalog),
    );
  }

  function selectDocument(id: string) {
    setComposeMode(false);
    setSelectedId(id);
  }

  function handleCreate() {
    startTransition(async () => {
      try {
        const result = await createBrandStrategyDocument({
          ownerBrandId: brandId,
          category: category.trim() || null,
          pmBrief: pmBrief.trim() || null,
          generationConfig,
        });
        toast.success("Dokumen strategi dibuat — AI sedang generate di background.");
        setComposeMode(false);
        setSelectedId(result.id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat dokumen."));
      }
    });
  }

  function handleCreateManual() {
    startTransition(async () => {
      try {
        const result = await createManualBrandStrategyDocument({
          ownerBrandId: brandId,
          category: category.trim() || null,
          pmBrief: pmBrief.trim() || null,
        });
        toast.success("Dokumen manual dibuat — isi field strategi lalu klik Simpan.");
        setComposeMode(false);
        setSelectedId(result.id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat dokumen manual."));
      }
    });
  }

  function handleSave() {
    if (!selected) return;
    startTransition(async () => {
      try {
        await updateBrandStrategyDocument({
          documentId: selected.id,
          brandPurpose,
          brandEssence,
          coreMessage,
          brandUsp,
          stp: {
            segment: stpSegment,
            targeting: stpTargeting,
            positioningStatement: stpPositioning,
          },
          brandPersonality: {
            archetype,
            traits: parseLines(traits),
            antiTraits: parseLines(antiTraits),
          },
          toneOfVoice: {
            principles: parseLines(tonePrinciples),
            doExamples: parseLines(toneDo),
            dontExamples: parseLines(toneDont),
          },
        });
        toast.success("Perubahan disimpan.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan."));
      }
    });
  }

  function handleRegenerateSection(field: StrategySectionField) {
    if (!selected) return;
    setSectionPending(field);
    startTransition(async () => {
      try {
        await regenerateBrandStrategySectionAction(selected.id, field);
        toast.success(`Regenerate ${field} dimulai.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal regenerate section."));
      } finally {
        setSectionPending(null);
      }
    });
  }

  function handleRegenerate() {
    if (!selected) return;
    startTransition(async () => {
      try {
        await regenerateBrandStrategyDocument(selected.id, generationConfig);
        toast.success("Regenerate dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal regenerate."));
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus dokumen strategi ini?")) return;
    startTransition(async () => {
      try {
        await deleteBrandStrategyDocument(id);
        if (selectedId === id) {
          setSelectedId(null);
          setComposeMode(false);
        }
        toast.success("Dokumen dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  // Kelengkapan dokumen — dihitung dari field yang sedang diedit (murah, tanpa query).
  const coreFields = [
    brandPurpose,
    brandEssence,
    coreMessage,
    brandUsp,
    stpPositioning,
    archetype,
    tonePrinciples,
  ];
  const filledCount = coreFields.filter((v) => v.trim().length > 0).length;
  const isManual = selected ? isManualStrategyDoc(selected) : false;

  return (
    <div className={cn("flex flex-col gap-6 lg:flex-row", lab.entrance)}>
      <LabDocumentSidebar
        title="Dokumen"
        action={
          <Button
            size="sm"
            variant={composeMode ? "default" : "outline"}
            onClick={startCompose}
            disabled={pending}
          >
            <Plus className="size-3.5" />
            Baru
          </Button>
        }
      >
        {documents.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2 text-xs">
            Belum ada dokumen strategi.
          </p>
        ) : (
          documents.map((d) => {
            const active = d.id === selectedId && !composeMode;
            const meta = docStatusMeta(d.status);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => selectDocument(d.id)}
                className={cn(
                  "flex w-full flex-col gap-1 rounded-xl border-l-2 border-l-transparent px-3 py-2.5 text-left text-xs transition-colors",
                  active
                    ? "border-l-[var(--lab-accent,var(--primary))] bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] text-foreground"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                <span className="line-clamp-2 font-medium">
                  {d.brandEssence || "Brand Strategy"}
                </span>
                <span className="flex items-center gap-1.5 text-[10px]">
                  <span
                    className={cn("size-1.5 shrink-0 rounded-full", meta.dot)}
                    aria-hidden
                  />
                  {meta.label} · v{d.version}
                </span>
              </button>
            );
          })
        )}
      </LabDocumentSidebar>

      <div className="min-w-0 flex-1">
        {!showWorkspace ? (
          <LabEmptyState
            icon={Compass}
            title="Belum ada dokumen dipilih"
            description={
              documents.length > 0
                ? "Pilih dokumen di daftar kiri, klik Baru untuk generate dengan AI, atau Input manual kalau sudah punya strategi sendiri."
                : "Klik Baru untuk generate dengan AI, atau Input manual kalau sudah punya brand strategy sendiri."
            }
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" onClick={startCompose}>
                  <Sparkles className="size-3.5" />
                  Buat dengan AI
                </Button>
                <Button size="sm" variant="outline" onClick={handleCreateManual} disabled={pending}>
                  <PenLine className="size-3.5" />
                  Input manual
                </Button>
              </div>
            }
          />
        ) : composeMode && !selected ? (
          <div className={cn("flex flex-col gap-4", lab.entrance)}>
            <section className="bento-tile justify-start gap-4">
              <div>
                <span className="bento-label">Konteks generate</span>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  Portfolio brand menjadi fondasi utama. Kategori dan brief PM
                  melengkapi interpretasi evidence.
                </p>
                {brandId ? (
                  <p className="text-muted-foreground mt-1.5 text-xs">
                    Pastikan{" "}
                    <Link
                      href={`/brand-hub/portfolio?brandId=${encodeURIComponent(brandId)}`}
                      className="text-[var(--lab-accent,var(--primary))] underline-offset-2 hover:underline"
                    >
                      Brand Portfolio
                    </Link>{" "}
                    sudah berisi semua lini produk sebelum generate.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Kategori produk</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="mis. body lotion, serum wajah"
                  />
                </div>
                <div className="grid gap-1.5 md:col-span-2">
                  <Label className="text-xs">Brief PM (opsional)</Label>
                  <Textarea
                    value={pmBrief}
                    onChange={(e) => setPmBrief(e.target.value)}
                    rows={3}
                    placeholder="Target audiens, constraint brand, arahan kreatif…"
                  />
                </div>
              </div>
            </section>
            <BrandStrategySourcePicker
              catalog={sourceCatalog}
              config={generationConfig}
              onChange={setGenerationConfig}
            />
            <BrandEvidencePanel
              readiness={evidenceReadiness}
              brandId={brandId}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleCreate}
                disabled={pending || !canGenerate}
                title={
                  canGenerate
                    ? undefined
                    : "Lengkapi Market Evidence terlebih dahulu"
                }
              >
                <Sparkles className="size-3.5" />
                Generate dokumen
              </Button>
              <Button
                variant="outline"
                onClick={handleCreateManual}
                disabled={pending}
                title="Buat dokumen kosong untuk diisi strategi yang sudah kamu punya — tanpa AI"
              >
                <PenLine className="size-3.5" />
                Input manual
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setComposeMode(false)}
                disabled={pending}
              >
                Batal
              </Button>
            </div>
          </div>
        ) : selected ? (
          <div className="flex flex-col-reverse gap-6 lg:flex-row">
            {/* Kolom dokumen — section konten dalam bento tiles */}
            <div className={cn("flex min-w-0 flex-1 flex-col gap-4", lab.entrance)}>
              {isManual ? (
                <div className="border-border/60 bg-muted/20 text-muted-foreground flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs">
                  <PenLine className="size-3.5 shrink-0" />
                  Dokumen manual — diisi tangan, tanpa AI. Isi field di bawah lalu
                  simpan lewat panel ringkasan.
                </div>
              ) : null}

              {selected.errorMessage ? (
                <p
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300"
                  role="alert"
                >
                  {selected.errorMessage}
                </p>
              ) : null}

              {/* Brand Foundation */}
              <section className="bento-tile justify-start gap-4">
                <div>
                  <span className="bento-label">Brand Foundation</span>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Purpose, essence, core message, dan USP branding.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Brand Purpose"
                    value={brandPurpose}
                    onChange={setBrandPurpose}
                    sectionField="brandPurpose"
                    onRegenSection={handleRegenerateSection}
                    sectionPending={sectionPending}
                    regenDisabled={pending || isGenerating}
                  />
                  <Field
                    label="Brand Essence"
                    value={brandEssence}
                    onChange={setBrandEssence}
                    sectionField="brandEssence"
                    onRegenSection={handleRegenerateSection}
                    sectionPending={sectionPending}
                    regenDisabled={pending || isGenerating}
                  />
                  <Field
                    label="Core Message"
                    value={coreMessage}
                    onChange={setCoreMessage}
                    className="md:col-span-2"
                    sectionField="coreMessage"
                    onRegenSection={handleRegenerateSection}
                    sectionPending={sectionPending}
                    regenDisabled={pending || isGenerating}
                  />
                  <Field
                    label="Brand USP (branding)"
                    value={brandUsp}
                    onChange={setBrandUsp}
                    className="md:col-span-2"
                    sectionField="brandUsp"
                    onRegenSection={handleRegenerateSection}
                    sectionPending={sectionPending}
                    regenDisabled={pending || isGenerating}
                  />
                </div>
              </section>

              {/* STP */}
              <section className="bento-tile justify-start gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="bento-label">STP</span>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Segmenting, targeting, dan positioning brand.
                    </p>
                  </div>
                  <SectionRegen
                    field="stp"
                    pending={sectionPending}
                    disabled={pending || isGenerating}
                    onRegen={handleRegenerateSection}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Segment</Label>
                    <Input value={stpSegment} onChange={(e) => setStpSegment(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Targeting</Label>
                    <Input value={stpTargeting} onChange={(e) => setStpTargeting(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5 md:col-span-2">
                    <Label className="text-xs">Positioning Statement</Label>
                    <Textarea value={stpPositioning} onChange={(e) => setStpPositioning(e.target.value)} rows={2} />
                  </div>
                </div>
              </section>

              {/* Brand Personality */}
              <section className="bento-tile justify-start gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="bento-label">Brand Personality</span>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Archetype dan karakter brand.
                    </p>
                  </div>
                  <SectionRegen
                    field="brandPersonality"
                    pending={sectionPending}
                    disabled={pending || isGenerating}
                    onRegen={handleRegenerateSection}
                  />
                </div>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Archetype</Label>
                    <Input value={archetype} onChange={(e) => setArchetype(e.target.value)} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Traits (satu per baris)</Label>
                      <Textarea value={traits} onChange={(e) => setTraits(e.target.value)} rows={3} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Anti-trait (satu per baris)</Label>
                      <Textarea value={antiTraits} onChange={(e) => setAntiTraits(e.target.value)} rows={3} />
                    </div>
                  </div>
                </div>
              </section>

              {/* Tone of Voice */}
              <section className="bento-tile justify-start gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="bento-label">Tone of Voice</span>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Prinsip bahasa brand beserta contoh do & don&apos;t.
                    </p>
                  </div>
                  <SectionRegen
                    field="toneOfVoice"
                    pending={sectionPending}
                    disabled={pending || isGenerating}
                    onRegen={handleRegenerateSection}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Principles</Label>
                    <Textarea value={tonePrinciples} onChange={(e) => setTonePrinciples(e.target.value)} rows={4} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Do examples</Label>
                    <Textarea value={toneDo} onChange={(e) => setToneDo(e.target.value)} rows={4} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Don&apos;t examples</Label>
                    <Textarea value={toneDont} onChange={(e) => setToneDont(e.target.value)} rows={4} />
                  </div>
                </div>
              </section>

              {/* Product Line Strategy */}
              {Array.isArray(selected.productLineStrategy) &&
              selected.productLineStrategy.length > 0 ? (
                <section className="bento-tile justify-start gap-4">
                  <div>
                    <span className="bento-label">Product Line Strategy</span>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Arah positioning per lini produk dalam portfolio brand.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {selected.productLineStrategy.map((line, i) => (
                      <article
                        key={`${line.lineName}-${i}`}
                        className="border-border/60 bg-muted/20 flex flex-col gap-2 rounded-xl border p-4 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold tracking-tight">{line.lineName}</p>
                          {line.role ? (
                            <span className="rounded-full bg-pink-500/12 px-2 py-0.5 text-[10px] font-semibold text-pink-700 dark:text-pink-300">
                              {line.role}
                            </span>
                          ) : null}
                          {line.category ? (
                            <span className="text-muted-foreground text-[10px]">
                              {line.category}
                            </span>
                          ) : null}
                        </div>
                        <p>
                          <span className="text-muted-foreground text-xs">Positioning · </span>
                          {line.positioning}
                        </p>
                        <p>
                          <span className="text-muted-foreground text-xs">Key message · </span>
                          {line.keyMessage}
                        </p>
                        <p>
                          <span className="text-muted-foreground text-xs">Differentiator · </span>
                          {line.differentiator}
                        </p>
                        {line.portfolioFit ? (
                          <p className="text-muted-foreground text-xs">{line.portfolioFit}</p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Strategic Tensions */}
              {Array.isArray(selected.strategicTensions) &&
              selected.strategicTensions.length > 0 ? (
                <section className="bento-tile justify-start gap-4">
                  <div>
                    <span className="bento-label">Strategic Tensions</span>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Tensi pasar yang brand harus navigasi.
                    </p>
                  </div>
                  <div className="grid gap-3">
                    {selected.strategicTensions.map((t, i) => (
                      <div
                        key={`${t.tension}-${i}`}
                        className="border-border/60 bg-muted/20 rounded-xl border p-3.5 text-sm"
                      >
                        <p className="font-semibold tracking-tight">{t.tension}</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {t.poleA} ↔ {t.poleB}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed">{t.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <ActionPlanPanel
                plan={selected.actionPlan}
                title="Rencana Aksi"
                subtitle="Rekomendasi lintas fungsi berdasarkan evidence strategi."
              />

              <BrandStrategyRationalePanel
                rationales={selected.strategyRationales}
                brandId={brandId}
              />

              {!isManual ? (
                <>
                  <BrandStrategySourcePicker
                    catalog={sourceCatalog}
                    config={generationConfig}
                    onChange={setGenerationConfig}
                  />
                  <BrandEvidencePanel
                    readiness={evidenceReadiness}
                    evidenceRefs={selected.evidenceRefs}
                    brandId={brandId}
                  />
                </>
              ) : null}
            </div>

            {/* Rail ringkasan — sticky di desktop */}
            <aside className="w-full shrink-0 lg:w-56 xl:w-64">
              <div className={cn("flex flex-col gap-3 lg:sticky lg:top-20", lab.entrance)}>
                {/* Hero pink: kelengkapan dokumen */}
                <div className="bento-tile min-h-[6.75rem] border-transparent bg-pink-600 shadow-md shadow-pink-600/20 dark:bg-pink-500">
                  <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
                    Kelengkapan dokumen
                  </span>
                  <span className="bento-value text-white dark:text-pink-950">
                    {filledCount}
                    <span className="text-lg font-bold text-pink-200/80 dark:text-pink-900/60">
                      /{coreFields.length}
                    </span>
                  </span>
                  <span className="text-[11px] font-medium leading-snug text-pink-100/90 dark:text-pink-900/80">
                    komponen inti strategi terisi
                  </span>
                </div>

                {/* Status dokumen */}
                <div className="bento-tile justify-start gap-2.5">
                  <span className="bento-label">Status dokumen</span>
                  <span
                    className={cn(
                      "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      docStatusMeta(selected.status).pill,
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        docStatusMeta(selected.status).dot,
                      )}
                      aria-hidden
                    />
                    {docStatusMeta(selected.status).label}
                  </span>
                  {isGenerating ? (
                    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                      <Loader2 className="size-3.5 animate-spin" />
                      AI sedang menulis…
                    </span>
                  ) : null}
                  {selected.citationQuality?.totalRefs ? (
                    <span
                      className={cn(
                        "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        selected.citationQuality.passed
                          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-500/12 text-amber-700 dark:text-amber-300",
                      )}
                      title={`${selected.citationQuality.validRefs}/${selected.citationQuality.totalRefs} kutipan tergrounding di teks evidence nyata (bukan sekadar format). Sisanya kemungkinan parafrase bebas / halusinasi — verifikasi manual sebelum dipresentasikan.`}
                    >
                      Grounding {Math.round((selected.citationQuality.score ?? 0) * 100)}%
                      {selected.citationQuality.passed ? " ✓" : " — perlu review"}
                    </span>
                  ) : null}
                  {isManual ? (
                    <span className="bg-muted text-muted-foreground inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                      <PenLine className="size-3" />
                      Manual
                    </span>
                  ) : null}
                  <p className="text-muted-foreground text-[11px]">
                    v{selected.version} · diperbarui {formatUpdatedAt(selected.updatedAt)}
                  </p>
                </div>

                {/* Aksi */}
                <div className="bento-tile justify-start gap-2">
                  <span className="bento-label">Aksi</span>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={handleSave}
                    disabled={pending || isGenerating}
                  >
                    Simpan perubahan
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={handleRegenerate}
                    disabled={pending || isGenerating || !canGenerate}
                    title={canGenerate ? undefined : "Evidence belum cukup"}
                  >
                    <RefreshCw className="size-3.5" />
                    Regenerate
                  </Button>
                  {selected.status === "READY" ? (
                    <div className="[&_button]:w-full">
                      <BrandPdfExportButton
                        fileName="brand-strategy"
                        getPdfBase64={() => exportBrandStrategyPdfBase64(selected.id)}
                      />
                    </div>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive w-full"
                    onClick={() => handleDelete(selected.id)}
                    disabled={pending}
                  >
                    <Trash2 className="size-3.5" />
                    Hapus dokumen
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionRegen({
  field,
  pending,
  disabled,
  onRegen,
}: {
  field: StrategySectionField;
  pending: StrategySectionField | null;
  disabled: boolean;
  onRegen: (field: StrategySectionField) => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-7 shrink-0 text-xs"
      disabled={disabled || pending === field}
      onClick={() => onRegen(field)}
    >
      {pending === field ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <RefreshCw className="size-3" />
      )}
      Regenerate
    </Button>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
  sectionField,
  onRegenSection,
  sectionPending,
  regenDisabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  sectionField?: StrategySectionField;
  onRegenSection?: (field: StrategySectionField) => void;
  sectionPending?: StrategySectionField | null;
  regenDisabled?: boolean;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        {sectionField && onRegenSection ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px]"
            disabled={regenDisabled || sectionPending === sectionField}
            onClick={() => onRegenSection(sectionField)}
          >
            {sectionPending === sectionField ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
          </Button>
        ) : null}
      </div>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
    </div>
  );
}

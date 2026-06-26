"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Compass, Loader2, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createBrandStrategyDocument,
  deleteBrandStrategyDocument,
  exportBrandStrategyPdfHtml,
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
import { Badge } from "@/components/ui/badge";
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
  BrandHubDocumentSidebar,
  BrandHubEmptyState,
  BrandHubSection,
  hub,
} from "@/components/brand-hub/brand-hub-primitives";
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

function parseLines(s: string): string[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function linesJoin(arr: string[] | undefined): string {
  return arr?.join("\n") ?? "";
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

  useEffect(() => {
    setGenerationConfig(defaultGenerationConfig);
  }, [defaultGenerationConfig]);

  useEffect(() => {
    if (!selected?.generationConfig) return;
    const saved = selected.generationConfig as StrategyGenerationConfig;
    if (saved.review) {
      setGenerationConfig(normalizeStrategyGenerationConfig(saved, sourceCatalog));
    }
  }, [selected?.id, selected?.generationConfig, sourceCatalog]);

  useEffect(() => {
    if (!selected) return;
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

  return (
    <div className={cn("flex flex-col gap-8 lg:flex-row", hub.entrance)}>
      <BrandHubDocumentSidebar
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
        {documents.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => selectDocument(d.id)}
            className={cn(
              "flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left text-xs transition-colors",
              d.id === selectedId && !composeMode
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            <span className="font-medium line-clamp-2">
              {d.brandEssence || "Brand Strategy"}
            </span>
            <Badge
              variant="secondary"
              className={cn(
                "w-fit text-[10px]",
                d.id === selectedId && !composeMode && "bg-primary-foreground/15 text-primary-foreground",
              )}
            >
              {d.status}
            </Badge>
          </button>
        ))}
      </BrandHubDocumentSidebar>

      <div className="min-w-0 flex-1">
        {!showWorkspace ? (
          <BrandHubEmptyState
            icon={Compass}
            title="Belum ada dokumen dipilih"
            description={
              documents.length > 0
                ? "Pilih dokumen di daftar kiri, atau klik Baru untuk membuat strategi dengan AI."
                : "Klik Baru untuk memilih sumber data dan generate dokumen strategi pertama."
            }
            action={
              <Button size="sm" onClick={startCompose}>
                <Sparkles className="size-3.5" />
                Buat dokumen baru
              </Button>
            }
          />
        ) : composeMode && !selected ? (
          <div className={cn("flex flex-col gap-5", hub.entrance)}>
            <BrandHubSection
              title="Konteks generate"
              description="Portfolio brand menjadi fondasi utama. Kategori dan brief PM melengkapi interpretasi evidence."
            >
              {brandId ? (
                <p className="text-muted-foreground mb-3 text-xs">
                  Pastikan{" "}
                  <Link
                    href={`/brand-hub/portfolio?brandId=${encodeURIComponent(brandId)}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Brand Portfolio
                  </Link>{" "}
                  sudah berisi semua lini produk sebelum generate.
                </p>
              ) : null}
              <div className={cn(hub.panel, "grid gap-4 md:grid-cols-2")}>
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
            </BrandHubSection>
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
          <div className={cn("flex flex-col gap-5", hub.entrance)}>
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
            <div className="flex flex-wrap items-center gap-2">
              {isGenerating ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-primary">
                  <Loader2 className="size-3.5 animate-spin" />
                  Generating…
                </span>
              ) : null}
              {selected.citationQuality?.totalRefs ? (
                <Badge
                  variant={selected.citationQuality.passed ? "secondary" : "outline"}
                  className="text-[10px]"
                  title={`${selected.citationQuality.validRefs}/${selected.citationQuality.totalRefs} kutipan tergrounding di teks evidence nyata (bukan sekadar format). Sisanya kemungkinan parafrase bebas / halusinasi — verifikasi manual sebelum dipresentasikan.`}
                >
                  Grounding kutipan: {Math.round((selected.citationQuality.score ?? 0) * 100)}%
                  {selected.citationQuality.passed ? " ✓" : " — perlu review"}
                </Badge>
              ) : null}
              <Badge variant="outline" className="text-[10px]">
                v{selected.version}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRegenerate}
                disabled={pending || isGenerating || !canGenerate}
                title={canGenerate ? undefined : "Evidence belum cukup"}
              >
                <RefreshCw className="size-3.5" />
                Regenerate
              </Button>
              <Button size="sm" onClick={handleSave} disabled={pending || isGenerating}>
                Simpan
              </Button>
              {selected.status === "READY" ? (
                <BrandPdfExportButton
                  fileName="brand-strategy"
                  getHtml={() => exportBrandStrategyPdfHtml(selected.id)}
                />
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(selected.id)}
                disabled={pending}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>

            {selected.errorMessage ? (
              <p
                className={cn(
                  hub.nestedPanel,
                  "text-destructive text-sm",
                )}
                role="alert"
              >
                {selected.errorMessage}
              </p>
            ) : null}

            <BrandStrategyRationalePanel
              rationales={selected.strategyRationales}
              brandId={brandId}
            />

            {Array.isArray(selected.strategicTensions) &&
            selected.strategicTensions.length > 0 ? (
              <BrandHubSection
                title="Strategic Tensions"
                description="Tensi pasar yang brand harus navigasi."
              >
                <div className={cn(hub.panel, "grid gap-3")}>
                  {selected.strategicTensions.map((t, i) => (
                    <div
                      key={`${t.tension}-${i}`}
                      className="rounded-lg border border-border/50 bg-muted/10 p-3 text-sm"
                    >
                      <p className="font-medium">{t.tension}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {t.poleA} ↔ {t.poleB}
                      </p>
                      <p className="mt-2 text-xs">{t.recommendation}</p>
                    </div>
                  ))}
                </div>
              </BrandHubSection>
            ) : null}

            <ActionPlanPanel
              plan={selected.actionPlan}
              title="Rencana Aksi"
              subtitle="Rekomendasi lintas fungsi berdasarkan evidence strategi."
            />

            <BrandHubSection title="Brand Foundation" description="Purpose, essence, message, dan USP branding.">
              <div className={cn(hub.panel, "grid gap-4 md:grid-cols-2")}>
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
            </BrandHubSection>

            {Array.isArray(selected.productLineStrategy) &&
            selected.productLineStrategy.length > 0 ? (
              <BrandHubSection
                title="Product Line Strategy"
                description="Arah positioning per lini produk dalam portfolio brand."
                delayMs={25}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {selected.productLineStrategy.map((line, i) => (
                    <article
                      key={`${line.lineName}-${i}`}
                      className={cn(
                        hub.panel,
                        "flex flex-col gap-2 p-4 text-sm",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{line.lineName}</p>
                        {line.role ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {line.role}
                          </Badge>
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
              </BrandHubSection>
            ) : null}

            <BrandHubSection title="STP" delayMs={50}>
              <SectionRegen
                field="stp"
                pending={sectionPending}
                disabled={pending || isGenerating}
                onRegen={handleRegenerateSection}
              />
              <div className={hub.panel}>
                <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Segment</Label>
                  <Input value={stpSegment} onChange={(e) => setStpSegment(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Targeting</Label>
                  <Input value={stpTargeting} onChange={(e) => setStpTargeting(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Positioning Statement</Label>
                  <Textarea value={stpPositioning} onChange={(e) => setStpPositioning(e.target.value)} rows={2} />
                </div>
                </div>
              </div>
            </BrandHubSection>

            <BrandHubSection title="Brand Personality" delayMs={100}>
              <SectionRegen
                field="brandPersonality"
                pending={sectionPending}
                disabled={pending || isGenerating}
                onRegen={handleRegenerateSection}
              />
              <div className={hub.panel}>
                <div className="grid gap-3">
                <div>
                  <Label className="text-xs">Archetype</Label>
                  <Input value={archetype} onChange={(e) => setArchetype(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Traits (satu per baris)</Label>
                  <Textarea value={traits} onChange={(e) => setTraits(e.target.value)} rows={3} />
                </div>
                <div>
                  <Label className="text-xs">Anti-trait (satu per baris)</Label>
                  <Textarea value={antiTraits} onChange={(e) => setAntiTraits(e.target.value)} rows={3} />
                </div>
                </div>
              </div>
            </BrandHubSection>

            <BrandHubSection title="Tone of Voice" delayMs={150}>
              <SectionRegen
                field="toneOfVoice"
                pending={sectionPending}
                disabled={pending || isGenerating}
                onRegen={handleRegenerateSection}
              />
              <div className={hub.panel}>
                <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs">Principles</Label>
                  <Textarea value={tonePrinciples} onChange={(e) => setTonePrinciples(e.target.value)} rows={4} />
                </div>
                <div>
                  <Label className="text-xs">Do examples</Label>
                  <Textarea value={toneDo} onChange={(e) => setToneDo(e.target.value)} rows={4} />
                </div>
                <div>
                  <Label className="text-xs">Don&apos;t examples</Label>
                  <Textarea value={toneDont} onChange={(e) => setToneDont(e.target.value)} rows={4} />
                </div>
                </div>
              </div>
            </BrandHubSection>
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
    <div className="mb-2 flex justify-end">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        disabled={disabled || pending === field}
        onClick={() => onRegen(field)}
      >
        {pending === field ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <RefreshCw className="size-3" />
        )}
        Regenerate section
      </Button>
    </div>
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

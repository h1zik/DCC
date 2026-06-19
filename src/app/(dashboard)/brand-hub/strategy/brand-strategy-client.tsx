"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createBrandStrategyDocument,
  deleteBrandStrategyDocument,
  exportBrandStrategyPdfHtml,
  regenerateBrandStrategyDocument,
  updateBrandStrategyDocument,
} from "@/actions/brand-strategy";
import { actionErrorMessage } from "@/lib/action-error-message";
import { BrandPdfExportButton } from "@/components/brand-hub/brand-pdf-export-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  ownerBrandId: string | null;
  brandPurpose: string | null;
  brandEssence: string | null;
  coreMessage: string | null;
  brandUsp: string | null;
  stp: Stp | null;
  brandPersonality: Personality | null;
  toneOfVoice: Tone | null;
  evidenceRefs: unknown;
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
}: {
  documents: StrategyDocumentView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    documents[0]?.id ?? null,
  );

  const selected = documents.find((d) => d.id === selectedId) ?? null;
  const isGenerating = selected?.status === "GENERATING";

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

  useEffect(() => {
    if (!isGenerating) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [isGenerating, router]);

  function handleCreate() {
    startTransition(async () => {
      try {
        const result = await createBrandStrategyDocument({});
        toast.success("Dokumen strategi dibuat — AI sedang generate.");
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

  function handleRegenerate() {
    if (!selected) return;
    startTransition(async () => {
      try {
        await regenerateBrandStrategyDocument(selected.id);
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
        toast.success("Dokumen dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-3 lg:w-56">
        <Button size="sm" onClick={handleCreate} disabled={pending}>
          <Plus className="size-3.5" />
          Dokumen baru
        </Button>
        <ul className="flex flex-col gap-1">
          {documents.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-xs transition-colors",
                  d.id === selectedId
                    ? "bg-foreground text-background"
                    : "hover:bg-muted text-muted-foreground",
                )}
              >
                <span className="font-medium line-clamp-1">
                  {d.brandEssence || "Brand Strategy"}
                </span>
                <Badge variant="secondary" className="mt-1 text-[10px]">
                  {d.status}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="min-w-0 flex-1">
        {!selected ? (
          <p className="text-muted-foreground text-sm">
            Buat dokumen strategi brand pertama untuk mulai.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              {isGenerating ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-primary">
                  <Loader2 className="size-3.5 animate-spin" />
                  Generating…
                </span>
              ) : null}
              <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={pending || isGenerating}>
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
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {selected.errorMessage}
              </p>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Brand Purpose" value={brandPurpose} onChange={setBrandPurpose} />
              <Field label="Brand Essence" value={brandEssence} onChange={setBrandEssence} />
              <Field label="Core Message" value={coreMessage} onChange={setCoreMessage} className="md:col-span-2" />
              <Field label="Brand USP (branding)" value={brandUsp} onChange={setBrandUsp} className="md:col-span-2" />
            </div>

            <section className="rounded-xl border border-border/70 bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">STP</h3>
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
            </section>

            <section className="rounded-xl border border-border/70 bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Brand Personality</h3>
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
            </section>

            <section className="rounded-xl border border-border/70 bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Tone of Voice</h3>
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
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
    </div>
  );
}

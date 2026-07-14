"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createBrandCreativeGuideline,
  deleteBrandCreativeGuideline,
  exportBrandCreativeGuidelinePdfHtml,
  regenerateBrandCreativeGuideline,
} from "@/actions/brand-creative-guideline";
import { actionErrorMessage } from "@/lib/action-error-message";
import { BrandPdfExportButton } from "@/components/brand-hub/brand-pdf-export-button";
import { ColorPalettePanel } from "@/components/brand-hub/color-palette-panel";
import { MoodboardGrid } from "@/components/brand-hub/moodboard-grid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { GuidelineReadiness } from "@/lib/brand-research/strategy/evidence-gate";
import type { SelectItemDef } from "@/lib/select-option-items";
import { useBrandHubBrandId } from "@/hooks/use-brand-hub-brand-id";
import { useBrandStudioGenerationPoll } from "../use-brand-studio-generation-poll";
import {
  LabDocumentSidebar,
  LabSection,
  lab,
} from "@/components/lab/lab-primitives";
import { cn } from "@/lib/utils";

type Palette = {
  primary?: string;
  secondary?: string;
  accent?: string;
  neutrals?: string[];
  rationale?: string;
};

type Typography = {
  heading?: string;
  body?: string;
  accent?: string;
  stylingNotes?: string;
};

type DesignRef = {
  category?: string;
  assetIds?: string[];
  narrative?: string;
};

export type CreativeGuidelineView = {
  id: string;
  status: string;
  ownerBrandId: string | null;
  strategyDocumentId: string | null;
  strategyEssence: string | null;
  moodboardAssetIds: unknown;
  colorPalette: Palette | null;
  typography: Typography | null;
  designReferences: DesignRef[] | null;
  aiSummary: string | null;
  errorMessage: string | null;
  updatedAt: string;
};

export type StrategyOption = { id: string; brandEssence: string | null };

export function BrandCreativeGuidelineClient({
  guidelines,
  strategyOptions,
  moodboardAssets,
  selectedGuidelineId,
  guidelineReadiness,
  visualAssetCount,
  defaultBrandId,
}: {
  guidelines: CreativeGuidelineView[];
  strategyOptions: StrategyOption[];
  moodboardAssets: { id: string; imageUrl: string; title: string | null }[];
  selectedGuidelineId: string | null;
  guidelineReadiness: GuidelineReadiness;
  visualAssetCount: number;
  defaultBrandId?: string | null;
}) {
  const router = useRouter();
  const brandId = useBrandHubBrandId(defaultBrandId);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    selectedGuidelineId ?? guidelines[0]?.id ?? null,
  );
  const [strategyPick, setStrategyPick] = useState<string>(
    strategyOptions[0]?.id ?? "",
  );

  const strategyItems = useMemo<SelectItemDef[]>(
    () =>
      strategyOptions.map((s) => ({
        value: s.id,
        label: s.brandEssence ?? s.id,
      })),
    [strategyOptions],
  );

  const selected = guidelines.find((g) => g.id === selectedId) ?? null;
  const isGenerating = selected?.status === "GENERATING";

  const moodboardIds = Array.isArray(selected?.moodboardAssetIds)
    ? (selected.moodboardAssetIds as string[])
    : [];
  const moodboard =
    moodboardIds.length > 0
      ? moodboardAssets.filter((a) => moodboardIds.includes(a.id))
      : moodboardAssets.slice(0, 12);

  useBrandStudioGenerationPoll({
    active: isGenerating,
    selectedId,
    brandId,
  });

  function handleCreate() {
    startTransition(async () => {
      try {
        const result = await createBrandCreativeGuideline({
          ownerBrandId: brandId,
          strategyDocumentId: strategyPick || null,
        });
        toast.success("Creative guideline dibuat — AI sedang generate di background.");
        setSelectedId(result.id);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat guideline."));
      }
    });
  }

  function handleRegenerate() {
    if (!selected) return;
    startTransition(async () => {
      try {
        await regenerateBrandCreativeGuideline(selected.id);
        toast.success("Regenerate dimulai.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal regenerate."));
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Hapus creative guideline ini?")) return;
    startTransition(async () => {
      try {
        await deleteBrandCreativeGuideline(id);
        toast.success("Guideline dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className={cn("flex flex-col gap-6 lg:flex-row", lab.entrance)}>
      <LabDocumentSidebar
        title="Guideline"
        action={
          <div className="grid w-full gap-2">
            {strategyOptions.length > 0 ? (
              <Select
                value={strategyPick}
                items={strategyItems}
                onValueChange={(v) => setStrategyPick(v ?? "")}
              >
                <SelectTrigger className="h-8 text-xs">
                  {strategyOptions.find((s) => s.id === strategyPick)?.brandEssence ??
                    "Pilih strategy"}
                </SelectTrigger>
                <SelectContent>
                  {strategyOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.brandEssence ?? s.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={pending || !guidelineReadiness.canGenerate}
              title={guidelineReadiness.message}
            >
              <Plus className="size-3.5" />
              Guideline baru
            </Button>
          </div>
        }
      >
        {guidelines.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setSelectedId(g.id)}
            className={cn(
              "flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left text-xs transition-colors",
              g.id === selectedId
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            <span className="font-medium line-clamp-1">
              {g.strategyEssence ?? "Creative Guideline"}
            </span>
            <Badge variant="secondary" className="mt-1 w-fit text-[10px]">
              {g.status}
            </Badge>
          </button>
        ))}
      </LabDocumentSidebar>

      <div className="min-w-0 flex-1 flex flex-col gap-5">
        {!guidelineReadiness.canGenerate ? (
          <p
            className={cn(
              lab.nestedPanel,
              "text-amber-800 dark:text-amber-200 text-sm",
            )}
          >
            {guidelineReadiness.message ??
              "Brand Strategy READY + minimal 5 visual assets diperlukan."}
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          Visual Library: {visualAssetCount} asset
          {visualAssetCount >= 5 ? " (cukup untuk palette deterministik)" : " (butuh ≥5)"}
        </p>
        {!selected ? (
          <p className="text-muted-foreground text-sm">
            Buat creative guideline dari dokumen strategi yang sudah READY.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {isGenerating ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--lab-accent,var(--primary))]">
                  <Loader2 className="size-3.5 animate-spin" />
                  Generating…
                </span>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={handleRegenerate}
                disabled={pending || isGenerating || !guidelineReadiness.canGenerate}
                title={guidelineReadiness.message}
              >
                <RefreshCw className="size-3.5" />
                Regenerate
              </Button>
              {selected.status === "READY" ? (
                <BrandPdfExportButton
                  fileName="creative-guideline"
                  getHtml={() => exportBrandCreativeGuidelinePdfHtml(selected.id)}
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
                  lab.nestedPanel,
                  "text-destructive text-sm",
                )}
                role="alert"
              >
                {selected.errorMessage}
              </p>
            ) : null}

            {selected.aiSummary ? (
              <LabSection title="AI Summary" delayMs={0}>
                <div className={cn(lab.panel, "text-muted-foreground text-sm leading-relaxed")}>
                  {selected.aiSummary}
                </div>
              </LabSection>
            ) : null}

            <LabSection title="Moodboard" delayMs={50}>
              {moodboard.length > 0 ? (
                <div className={lab.panel}>
                  <MoodboardGrid assets={moodboard} />
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Tambahkan visual di Visual Library terlebih dahulu.
                </p>
              )}
            </LabSection>

            <LabSection title="Color Palette" delayMs={100}>
              <div className={lab.panel}>
                <ColorPalettePanel
                  palette={selected.colorPalette}
                  derivedFromCount={visualAssetCount >= 5 ? visualAssetCount : undefined}
                />
              </div>
            </LabSection>

            {selected.typography ? (
              <LabSection title="Typography & Styling" delayMs={150}>
                <div className={lab.panel}>
                  <dl className="grid gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground text-xs">Heading</dt>
                      <dd className="font-medium">{selected.typography.heading ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Body</dt>
                      <dd className="font-medium">{selected.typography.body ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Accent</dt>
                      <dd className="font-medium">{selected.typography.accent ?? "—"}</dd>
                    </div>
                  </dl>
                  {selected.typography.stylingNotes ? (
                    <p className="text-muted-foreground mt-3 text-sm">
                      {selected.typography.stylingNotes}
                    </p>
                  ) : null}
                </div>
              </LabSection>
            ) : null}

            {selected.designReferences?.length ? (
              <LabSection title="Design References" delayMs={200}>
                <div className={lab.panel}>
                  <ul className="flex flex-col gap-3">
                    {selected.designReferences.map((ref, i) => (
                      <li key={i} className="border-border/50 border-b pb-3 last:border-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {ref.category ?? "Reference"}
                        </p>
                        <p className="mt-1 text-sm">{ref.narrative ?? ""}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </LabSection>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

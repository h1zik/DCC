"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
}: {
  guidelines: CreativeGuidelineView[];
  strategyOptions: StrategyOption[];
  moodboardAssets: { id: string; imageUrl: string; title: string | null }[];
  selectedGuidelineId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    selectedGuidelineId ?? guidelines[0]?.id ?? null,
  );
  const [strategyPick, setStrategyPick] = useState<string>(
    strategyOptions[0]?.id ?? "",
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

  useEffect(() => {
    if (!isGenerating) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [isGenerating, router]);

  function handleCreate() {
    startTransition(async () => {
      try {
        const result = await createBrandCreativeGuideline({
          strategyDocumentId: strategyPick || null,
        });
        toast.success("Creative guideline dibuat — AI sedang generate.");
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
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-3 lg:w-56">
        <div className="grid gap-2">
          {strategyOptions.length > 0 ? (
            <Select value={strategyPick} onValueChange={(v) => setStrategyPick(v ?? "")}>
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
          <Button size="sm" onClick={handleCreate} disabled={pending}>
            <Plus className="size-3.5" />
            Guideline baru
          </Button>
        </div>
        <ul className="flex flex-col gap-1">
          {guidelines.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => setSelectedId(g.id)}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-xs transition-colors",
                  g.id === selectedId
                    ? "bg-foreground text-background"
                    : "hover:bg-muted text-muted-foreground",
                )}
              >
                <span className="font-medium line-clamp-1">
                  {g.strategyEssence ?? "Creative Guideline"}
                </span>
                <Badge variant="secondary" className="mt-1 text-[10px]">
                  {g.status}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="min-w-0 flex-1 flex flex-col gap-5">
        {!selected ? (
          <p className="text-muted-foreground text-sm">
            Buat creative guideline dari dokumen strategi yang sudah READY.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {isGenerating ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-primary">
                  <Loader2 className="size-3.5 animate-spin" />
                  Generating…
                </span>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={handleRegenerate}
                disabled={pending || isGenerating}
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
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {selected.errorMessage}
              </p>
            ) : null}

            {selected.aiSummary ? (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {selected.aiSummary}
              </p>
            ) : null}

            <section>
              <h3 className="mb-3 text-sm font-semibold">Moodboard</h3>
              {moodboard.length > 0 ? (
                <MoodboardGrid assets={moodboard} />
              ) : (
                <p className="text-muted-foreground text-xs">
                  Tambahkan visual di Visual Library terlebih dahulu.
                </p>
              )}
            </section>

            <ColorPalettePanel palette={selected.colorPalette} />

            {selected.typography ? (
              <div className="rounded-xl border border-border/70 bg-card p-4">
                <h3 className="mb-3 text-sm font-semibold">Typography & Styling</h3>
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
            ) : null}

            {selected.designReferences?.length ? (
              <section className="rounded-xl border border-border/70 bg-card p-4">
                <h3 className="mb-3 text-sm font-semibold">Design References</h3>
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
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

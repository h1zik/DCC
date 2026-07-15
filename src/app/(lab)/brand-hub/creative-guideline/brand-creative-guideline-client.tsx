"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Images,
  Loader2,
  Palette as PaletteIcon,
  Plus,
  RefreshCw,
  Trash2,
  Type,
} from "lucide-react";
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
import { lab } from "@/components/lab/lab-primitives";
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

const STATUS_META: Record<
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
    pill: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  FAILED: {
    label: "Gagal",
    pill: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    pill: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        meta.pill,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

/** Header seksi konten: kapsul ikon tinted + bento-label. */
function SectionHead({
  icon: Icon,
  capsule,
  label,
  meta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  capsule: string;
  label: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            capsule,
          )}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
        <span className="bento-label">{label}</span>
      </span>
      {meta}
    </div>
  );
}

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
  const readyCount = guidelines.filter((g) => g.status === "READY").length;

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
    <div
      className={cn(
        "flex flex-col gap-6 lg:flex-row lg:items-start",
        lab.entrance,
      )}
    >
      {/* ---- Rail ringkasan (sticky di desktop) ---- */}
      <aside className="flex w-full shrink-0 flex-col gap-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-72 lg:overflow-y-auto lg:pr-1 xl:w-80">
        {/* Hero pink */}
        <div className="bento-tile border-transparent bg-pink-600 shadow-md shadow-pink-600/20 dark:bg-pink-500">
          <span className="text-[11.5px] font-semibold text-pink-100 dark:text-pink-950/70">
            Creative guideline
          </span>
          <span className="bento-value text-4xl text-white dark:text-pink-950">
            {guidelines.length}
          </span>
          <span className="text-[11px] font-medium leading-snug text-pink-100/90 dark:text-pink-900/80">
            {readyCount} siap dipakai — arah kreatif dari strategi brand & visual
            library
          </span>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bento-tile border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
            <span className="text-[11.5px] font-semibold text-pink-800/70 dark:text-pink-200/60">
              Visual asset
            </span>
            <span className="bento-value text-2xl text-pink-900 dark:text-pink-300">
              {visualAssetCount}
            </span>
            <span className="text-[10px] font-medium text-pink-800/60 dark:text-pink-200/50">
              {visualAssetCount >= 5
                ? "cukup untuk palet deterministik"
                : "butuh ≥5 untuk palet"}
            </span>
          </div>
          <div className="bento-tile border-transparent bg-[#ffedcd] dark:bg-amber-400/10">
            <span className="text-[11.5px] font-semibold text-amber-800/70 dark:text-amber-200/60">
              Strategi READY
            </span>
            <span className="bento-value text-2xl text-amber-900 dark:text-amber-300">
              {strategyOptions.length}
            </span>
            <span className="text-[10px] font-medium text-amber-800/60 dark:text-amber-200/50">
              sumber creative direction
            </span>
          </div>
        </div>

        {/* Form buat guideline */}
        <div className="bento-tile justify-start gap-3">
          <span className="bento-label">Guideline baru</span>
          {strategyOptions.length > 0 ? (
            <Select
              value={strategyPick}
              items={strategyItems}
              onValueChange={(v) => setStrategyPick(v ?? "")}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                {strategyOptions.find((s) => s.id === strategyPick)
                  ?.brandEssence ?? "Pilih strategy"}
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
            Buat guideline
          </Button>
          {!guidelineReadiness.canGenerate ? (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
              {guidelineReadiness.message ??
                "Brand Strategy READY + minimal 5 visual assets diperlukan."}
            </p>
          ) : null}
        </div>

        {/* Daftar guideline */}
        {guidelines.length > 0 ? (
          <nav className="flex flex-col gap-1" aria-label="Daftar guideline">
            {guidelines.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedId(g.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs transition-colors duration-150",
                  g.id === selectedId
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {g.strategyEssence ?? "Creative Guideline"}
                </span>
                <StatusPill status={g.status} />
              </button>
            ))}
          </nav>
        ) : null}
      </aside>

      {/* ---- Konten guideline terpilih ---- */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {!selected ? (
          <div className="border-border/70 bg-card/40 text-muted-foreground flex items-center gap-3 rounded-2xl border border-dashed p-5 text-sm">
            <PaletteIcon className="size-5 shrink-0 text-pink-600 dark:text-pink-400" />
            Buat creative guideline dari dokumen strategi yang sudah READY —
            moodboard, palet warna, dan typography dirangkum otomatis.
          </div>
        ) : (
          <>
            {/* Toolbar dokumen */}
            <div className="bento-tile flex-row items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <StatusPill status={selected.status} />
                {isGenerating ? (
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                    <Loader2 className="size-3.5 animate-spin" />
                    AI sedang menyusun guideline…
                  </span>
                ) : (
                  <span className="text-muted-foreground truncate text-xs">
                    Diperbarui{" "}
                    {new Date(selected.updatedAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={
                    pending || isGenerating || !guidelineReadiness.canGenerate
                  }
                  title={guidelineReadiness.message}
                >
                  <RefreshCw className="size-3.5" />
                  Regenerate
                </Button>
                {selected.status === "READY" ? (
                  <BrandPdfExportButton
                    fileName="creative-guideline"
                    getHtml={() =>
                      exportBrandCreativeGuidelinePdfHtml(selected.id)
                    }
                  />
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(selected.id)}
                  disabled={pending}
                  aria-label="Hapus guideline"
                >
                  <Trash2 className="text-destructive size-3.5" />
                </Button>
              </div>
            </div>

            {selected.errorMessage ? (
              <p
                className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300"
                role="alert"
              >
                {selected.errorMessage}
              </p>
            ) : null}

            {selected.aiSummary ? (
              <div className="bento-tile justify-start gap-3 border-transparent bg-[#fde7f1] dark:bg-pink-400/10">
                <span className="text-[11.5px] font-semibold text-pink-800/70 dark:text-pink-200/60">
                  Ringkasan AI
                </span>
                <p className="text-sm leading-relaxed text-pink-950/90 dark:text-pink-100/90">
                  {selected.aiSummary}
                </p>
              </div>
            ) : null}

            {/* Moodboard */}
            <div className="bento-tile justify-start gap-4">
              <SectionHead
                icon={Images}
                capsule="bg-pink-500/15 text-pink-700 dark:text-pink-300"
                label="Moodboard"
                meta={
                  moodboard.length > 0 ? (
                    <span className="text-muted-foreground text-xs font-medium tabular-nums">
                      {moodboard.length} visual
                    </span>
                  ) : null
                }
              />
              {moodboard.length > 0 ? (
                <MoodboardGrid assets={moodboard} />
              ) : (
                <p className="border-border/60 bg-muted/30 text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-xs">
                  Tambahkan visual di Visual Library terlebih dahulu.
                </p>
              )}
            </div>

            {/* Palet warna */}
            <div className="bento-tile justify-start gap-4">
              <SectionHead
                icon={PaletteIcon}
                capsule="bg-violet-500/15 text-violet-700 dark:text-violet-300"
                label="Palet warna"
              />
              {selected.colorPalette ? (
                <ColorPalettePanel
                  palette={selected.colorPalette}
                  derivedFromCount={
                    visualAssetCount >= 5 ? visualAssetCount : undefined
                  }
                />
              ) : (
                <p className="text-muted-foreground text-xs">
                  Palet muncul setelah guideline selesai digenerate.
                </p>
              )}
            </div>

            {/* Typography */}
            {selected.typography ? (
              <div className="bento-tile justify-start gap-4">
                <SectionHead
                  icon={Type}
                  capsule="bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  label="Typography & styling"
                />
                <dl className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      ["Heading", selected.typography.heading],
                      ["Body", selected.typography.body],
                      ["Accent", selected.typography.accent],
                    ] as const
                  ).map(([role, font]) => (
                    <div
                      key={role}
                      className="border-border/60 bg-muted/30 rounded-xl border p-3"
                    >
                      <dt className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                        {role}
                      </dt>
                      <dd className="text-foreground mt-1 text-sm font-bold tracking-tight">
                        {font ?? "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
                {selected.typography.stylingNotes ? (
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {selected.typography.stylingNotes}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Design references */}
            {selected.designReferences?.length ? (
              <div className="bento-tile justify-start gap-4">
                <SectionHead
                  icon={Images}
                  capsule="bg-teal-500/15 text-teal-700 dark:text-teal-300"
                  label="Design references"
                  meta={
                    <span className="text-muted-foreground text-xs font-medium tabular-nums">
                      {selected.designReferences.length} referensi
                    </span>
                  }
                />
                <ul className="flex flex-col gap-3">
                  {selected.designReferences.map((ref, i) => (
                    <li
                      key={i}
                      className="border-border/60 bg-muted/30 rounded-xl border p-3.5"
                    >
                      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
                        {ref.category ?? "Reference"}
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed">
                        {ref.narrative ?? ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

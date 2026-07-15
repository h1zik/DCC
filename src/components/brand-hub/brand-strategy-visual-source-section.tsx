"use client";

import { Eye, EyeOff, ImageIcon } from "lucide-react";
import type { StrategyGenerationConfig } from "@/lib/brand-research/strategy/evidence-types";
import type { StrategyVisualCatalog } from "@/lib/brand-research/strategy/strategy-visual-config";
import {
  VISUAL_ID_MANUAL,
  allVisualSourceIds,
  countSelectedVisualAssets,
  visualCompetitorId,
  visualPinterestId,
  visualSocialId,
} from "@/lib/brand-research/strategy/strategy-visual-config";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function VisualSubSection({
  title,
  items,
  selectedIds,
  disabled,
  onToggleId,
  onSelectAll,
  emptyLabel,
}: {
  title: string;
  items: { id: string; label: string; count: number; detail?: string }[];
  selectedIds: string[];
  disabled: boolean;
  onToggleId: (id: string, checked: boolean) => void;
  onSelectAll: (all: boolean) => void;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/50 px-3 py-2.5">
        <p className="text-muted-foreground text-xs">{emptyLabel}</p>
      </div>
    );
  }

  const allSelected = items.every((i) => selectedIds.includes(i.id));

  return (
    <div className="rounded-xl border border-border/40 bg-background/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">{title}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-[10px]"
          disabled={disabled}
          onClick={() => onSelectAll(!allSelected)}
        >
          {allSelected ? "Kosongkan" : "Pilih semua"}
        </Button>
      </div>
      <ul className="max-h-32 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <li
            key={item.id}
            className="hover:bg-muted/40 flex items-start gap-2 rounded-lg px-1.5 py-1"
          >
            <Checkbox
              id={`visual-${item.id}`}
              checked={!disabled && selectedIds.includes(item.id)}
              disabled={disabled}
              onCheckedChange={(v) => onToggleId(item.id, v === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor={`visual-${item.id}`}
              className="min-w-0 flex-1 text-xs font-normal leading-snug"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate">{item.label}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {item.count}
                </span>
              </span>
              {item.detail ? (
                <span className="text-muted-foreground block truncate text-[10px]">
                  {item.detail}
                </span>
              ) : null}
            </Label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BrandStrategyVisualSourceSection({
  catalog,
  visual,
  onChange,
}: {
  catalog: StrategyVisualCatalog;
  visual: StrategyGenerationConfig["visual"];
  onChange: (visual: StrategyGenerationConfig["visual"]) => void;
}) {
  const disabled = catalog.assetCount === 0;
  const selectedCount = countSelectedVisualAssets(catalog, visual);

  const pinterestItems = catalog.pinterest.map((p) => ({
    id: visualPinterestId(p.id),
    label: p.label,
    count: p.count,
    detail: p.detail,
  }));
  const competitorItems = catalog.competitor.map((c) => ({
    id: visualCompetitorId(c.id),
    label: c.label,
    count: c.count,
  }));
  const socialItems = catalog.social.map((s) => ({
    id: visualSocialId(s.id),
    label: s.label,
    count: s.count,
  }));

  function patchIds(nextIds: string[]) {
    onChange({
      ...visual,
      enabled: nextIds.length > 0,
      ids: nextIds,
    });
  }

  function toggleId(id: string, checked: boolean) {
    patchIds(
      checked
        ? [...new Set([...visual.ids, id])]
        : visual.ids.filter((x) => x !== id),
    );
  }

  function toggleGroup(
    items: { id: string }[],
    all: boolean,
  ) {
    const groupIds = items.map((i) => i.id);
    if (all) {
      patchIds([...new Set([...visual.ids, ...groupIds])]);
    } else {
      patchIds(visual.ids.filter((id) => !groupIds.includes(id)));
    }
  }

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-background/80 transition-colors",
        visual.enabled && !disabled
          ? "border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_30%,transparent)] shadow-sm"
          : "border-border/50",
        disabled && "opacity-55",
      )}
    >
      <div className="flex items-start gap-3 border-b border-border/40 bg-muted/20 px-4 py-3">
        <Checkbox
          id="src-visual"
          checked={visual.enabled && !disabled}
          disabled={disabled}
          onCheckedChange={(v) => {
            const enabled = v === true;
            onChange({
              ...visual,
              enabled,
              ids: enabled ? allVisualSourceIds(catalog) : [],
            });
          }}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ImageIcon className="text-muted-foreground size-4 shrink-0" />
            <Label htmlFor="src-visual" className="text-sm font-semibold">
              Visual Library
            </Label>
            {selectedCount > 0 ? (
              <span className="text-muted-foreground text-[10px] tabular-nums">
                {selectedCount} asset dipilih
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Pilih sumber visual: Pinterest per koleksi, kompetitor, social, atau
            manual.
          </p>
        </div>
        {!disabled && visual.enabled ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 text-[10px]"
            onClick={() =>
              onChange({
                ...visual,
                ids:
                  visual.ids.length === allVisualSourceIds(catalog).length
                    ? []
                    : allVisualSourceIds(catalog),
                enabled: visual.ids.length !== allVisualSourceIds(catalog).length,
              })
            }
          >
            {visual.ids.length === allVisualSourceIds(catalog).length
              ? "Kosongkan semua"
              : "Pilih semua"}
          </Button>
        ) : null}
      </div>

      <div className="space-y-3 px-4 py-3">
        {disabled ? (
          <p className="text-muted-foreground text-xs">
            Belum ada visual di library — tambahkan dari Pinterest, Competitor,
            Social, atau upload manual.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <VisualSubSection
              title="Pinterest"
              items={pinterestItems}
              selectedIds={visual.ids}
              disabled={!visual.enabled}
              onToggleId={toggleId}
              onSelectAll={(all) => toggleGroup(pinterestItems, all)}
              emptyLabel="Belum ada koleksi Pinterest."
            />
            <VisualSubSection
              title="Competitor"
              items={competitorItems}
              selectedIds={visual.ids}
              disabled={!visual.enabled}
              onToggleId={toggleId}
              onSelectAll={(all) => toggleGroup(competitorItems, all)}
              emptyLabel="Belum ada visual dari Competitor Tracker."
            />
            <VisualSubSection
              title="Social"
              items={socialItems}
              selectedIds={visual.ids}
              disabled={!visual.enabled}
              onToggleId={toggleId}
              onSelectAll={(all) => toggleGroup(socialItems, all)}
              emptyLabel="Belum ada visual dari Social Listening."
            />
            <div className="rounded-xl border border-border/40 bg-background/60 p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="visual-manual"
                  checked={
                    visual.enabled &&
                    visual.ids.includes(VISUAL_ID_MANUAL) &&
                    catalog.manualCount > 0
                  }
                  disabled={!visual.enabled || catalog.manualCount === 0}
                  onCheckedChange={(v) => toggleId(VISUAL_ID_MANUAL, v === true)}
                />
                <Label htmlFor="visual-manual" className="text-xs font-semibold">
                  Manual
                </Label>
                <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                  {catalog.manualCount}
                </span>
              </div>
            </div>
          </div>
        )}

        {visual.enabled && catalog.assetCount > 0 ? (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              visual.analyzeImages
                ? "border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_30%,transparent)] bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_5%,transparent)]"
                : "border-border/50 bg-muted/30",
            )}
          >
            <Checkbox
              id="visual-analyze-images"
              checked={visual.analyzeImages}
              onCheckedChange={(v) =>
                onChange({ ...visual, analyzeImages: v === true })
              }
              className="mt-0.5"
            />
            <div className="min-w-0">
              <Label
                htmlFor="visual-analyze-images"
                className="inline-flex items-center gap-1.5 text-xs font-semibold"
              >
                {visual.analyzeImages ? (
                  <Eye className="size-3.5 text-[var(--lab-accent,var(--primary))]" />
                ) : (
                  <EyeOff className="size-3.5" />
                )}
                AI melihat gambar (vision)
              </Label>
              <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                {visual.analyzeImages
                  ? `Gemini menganalisis hingga ${visual.maxSamples} sampel dari pilihan Anda — bukan hanya tags.`
                  : "Hanya tags & metadata teks yang dikirim ke AI (bukan gambar)."}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

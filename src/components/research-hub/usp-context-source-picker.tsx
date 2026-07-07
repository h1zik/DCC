"use client";

import { useMemo } from "react";
import {
  Check,
  Compass,
  MessageSquare,
  Package,
  Radar,
  Search,
  Sparkles,
  Star,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type {
  ContextModuleToggles,
  ContextSourceIds,
  UspContextSourceOptions,
} from "@/lib/research/usp-gap/context-types";
import { cn } from "@/lib/utils";

type ModuleKey = keyof ContextModuleToggles;

const MODULE_CONFIG: Record<
  ModuleKey,
  { label: string; short: string; icon: LucideIcon; hint: string }
> = {
  reviewIntel: {
    label: "Review Intelligence",
    short: "Review",
    icon: Star,
    hint: "Keluhan & pujian dari review kompetitor",
  },
  competitor: {
    label: "Competitor Tracker",
    short: "Kompetitor",
    icon: Target,
    hint: "Harga, SKU, dan klaim produk rival",
  },
  trendRadar: {
    label: "Trend Radar",
    short: "Tren",
    icon: Radar,
    hint: "Sinyal bahan, klaim, dan kategori",
  },
  keywordIntel: {
    label: "Keyword Intel",
    short: "Keyword",
    icon: Search,
    hint: "Gap keyword & cluster pencarian",
  },
  socialListening: {
    label: "Social Listening",
    short: "Sosial",
    icon: MessageSquare,
    hint: "Pain point & wishlist dari sosial",
  },
  productDiscovery: {
    label: "Product Discovery",
    short: "Discovery",
    icon: Compass,
    hint: "Landscape marketplace & top seller",
  },
  competitorProducts: {
    label: "Competitor Products",
    short: "Produk",
    icon: Package,
    hint: "Benchmark produk rival individual",
  },
};

type Props = {
  options: UspContextSourceOptions;
  available: ContextModuleToggles;
  modules: ContextModuleToggles;
  selections: ContextSourceIds;
  onToggleModule: (key: ModuleKey) => void;
  onSelectionsChange: (next: ContextSourceIds) => void;
};

function toggleId(list: string[] | undefined, id: string): string[] {
  const current = list ?? [];
  return current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id];
}

function selectionCount(
  key: ModuleKey,
  selections: ContextSourceIds,
): number | null {
  switch (key) {
    case "reviewIntel":
      return selections.reviewSourceIds?.length ?? 0;
    case "competitor":
      return selections.competitorIds?.length ?? 0;
    case "trendRadar":
      return selections.trendDigestId ? 1 : 0;
    case "keywordIntel":
      return selections.keywordQueryId ? 1 : 0;
    case "socialListening":
      return selections.socialMonitorId ? 1 : 0;
    case "productDiscovery":
      return selections.productDiscoveryQueryIds?.length ?? 0;
    case "competitorProducts":
      return selections.competitorProductCategoryIds?.length ?? 0;
    default:
      return 0;
  }
}

export function UspContextSourcePicker({
  options,
  available,
  modules,
  selections,
  onToggleModule,
  onSelectionsChange,
}: Props) {
  const enabledCount = useMemo(
    () =>
      (Object.keys(MODULE_CONFIG) as ModuleKey[]).filter(
        (k) => modules[k] && available[k],
      ).length,
    [modules, available],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-foreground text-sm font-medium">
          Sumber data riset
        </Label>
        <Badge variant="secondary" className="tabular-nums">
          {enabledCount} modul aktif
        </Badge>
      </div>

      <div className="space-y-2">
        {(Object.keys(MODULE_CONFIG) as ModuleKey[]).map((key) => {
          const config = MODULE_CONFIG[key];
          const Icon = config.icon;
          const enabled = !!modules[key];
          const hasData = !!available[key];
          const count = selectionCount(key, selections);
          const isOpen = enabled && hasData;

          return (
            <ModuleSourceBox
              key={key}
              config={config}
              icon={Icon}
              enabled={enabled}
              hasData={hasData}
              isOpen={isOpen}
              selectionCount={count}
              onToggle={() => onToggleModule(key)}
            >
              {key === "reviewIntel" ? (
                <SourceTileList
                  items={options.reviewSources}
                  selected={selections.reviewSourceIds ?? []}
                  emptyHint="Belum ada sumber review siap."
                  onToggle={(id) =>
                    onSelectionsChange({
                      ...selections,
                      reviewSourceIds: toggleId(selections.reviewSourceIds, id),
                    })
                  }
                  onSelectAll={(ids) =>
                    onSelectionsChange({
                      ...selections,
                      reviewSourceIds: ids,
                    })
                  }
                  onClear={() =>
                    onSelectionsChange({
                      ...selections,
                      reviewSourceIds: [],
                    })
                  }
                />
              ) : null}

              {key === "competitor" ? (
                <SourceTileList
                  items={options.competitors}
                  selected={selections.competitorIds ?? []}
                  emptyHint="Belum ada kompetitor aktif."
                  onToggle={(id) =>
                    onSelectionsChange({
                      ...selections,
                      competitorIds: toggleId(selections.competitorIds, id),
                    })
                  }
                  onSelectAll={(ids) =>
                    onSelectionsChange({
                      ...selections,
                      competitorIds: ids,
                    })
                  }
                  onClear={() =>
                    onSelectionsChange({
                      ...selections,
                      competitorIds: [],
                    })
                  }
                />
              ) : null}

              {key === "trendRadar" ? (
                <SingleSelectField
                  placeholder="Digest terbaru (auto-suggest)"
                  items={options.trendDigests}
                  value={selections.trendDigestId ?? ""}
                  onChange={(id) =>
                    onSelectionsChange({
                      ...selections,
                      trendDigestId: id || undefined,
                    })
                  }
                />
              ) : null}

              {key === "keywordIntel" ? (
                <SingleSelectField
                  placeholder="Query terbaru (auto-suggest)"
                  items={options.keywordQueries}
                  value={selections.keywordQueryId ?? ""}
                  onChange={(id) =>
                    onSelectionsChange({
                      ...selections,
                      keywordQueryId: id || undefined,
                    })
                  }
                />
              ) : null}

              {key === "socialListening" ? (
                <SingleSelectField
                  placeholder="Monitor terbaru (auto-suggest)"
                  items={options.socialMonitors}
                  value={selections.socialMonitorId ?? ""}
                  onChange={(id) =>
                    onSelectionsChange({
                      ...selections,
                      socialMonitorId: id || undefined,
                    })
                  }
                />
              ) : null}

              {key === "productDiscovery" ? (
                <SourceTileList
                  items={options.productDiscoveryQueries}
                  selected={selections.productDiscoveryQueryIds ?? []}
                  emptyHint="Belum ada query discovery siap."
                  onToggle={(id) =>
                    onSelectionsChange({
                      ...selections,
                      productDiscoveryQueryIds: toggleId(
                        selections.productDiscoveryQueryIds,
                        id,
                      ),
                    })
                  }
                  onSelectAll={(ids) =>
                    onSelectionsChange({
                      ...selections,
                      productDiscoveryQueryIds: ids,
                    })
                  }
                  onClear={() =>
                    onSelectionsChange({
                      ...selections,
                      productDiscoveryQueryIds: [],
                    })
                  }
                />
              ) : null}

              {key === "competitorProducts" ? (
                <SourceTileList
                  items={options.competitorProductCategories}
                  selected={selections.competitorProductCategoryIds ?? []}
                  emptyHint="Belum ada kategori produk kompetitor."
                  onToggle={(id) =>
                    onSelectionsChange({
                      ...selections,
                      competitorProductCategoryIds: toggleId(
                        selections.competitorProductCategoryIds,
                        id,
                      ),
                    })
                  }
                  onSelectAll={(ids) =>
                    onSelectionsChange({
                      ...selections,
                      competitorProductCategoryIds: ids,
                    })
                  }
                  onClear={() =>
                    onSelectionsChange({
                      ...selections,
                      competitorProductCategoryIds: [],
                    })
                  }
                />
              ) : null}
            </ModuleSourceBox>
          );
        })}
      </div>

      <div className="border-border/60 bg-muted/30 flex gap-2.5 rounded-xl border px-3 py-2.5">
        <Sparkles
          className="text-primary mt-0.5 size-4 shrink-0"
          aria-hidden
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Kosongkan pilihan di dalam modul → sistem akan{" "}
          <span className="text-foreground font-medium">auto-suggest</span>{" "}
          berdasarkan kategori. Gunakan tombol Saran di atas untuk mengisi
          cepat.
        </p>
      </div>
    </div>
  );
}

export function ModuleSourceBox({
  config,
  icon: Icon,
  enabled,
  hasData,
  isOpen,
  selectionCount,
  onToggle,
  children,
}: {
  config: (typeof MODULE_CONFIG)[ModuleKey];
  icon: LucideIcon;
  enabled: boolean;
  hasData: boolean;
  isOpen: boolean;
  selectionCount: number | null;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-all duration-200",
        !hasData && "opacity-55",
        enabled && hasData
          ? "border-primary/35 bg-primary/[0.03] shadow-sm"
          : "border-border/70 bg-card",
      )}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          disabled={!hasData}
          onClick={onToggle}
          aria-pressed={enabled && hasData}
          className={cn(
            "flex w-11 shrink-0 items-center justify-center border-r transition-colors",
            enabled && hasData
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-border/60 bg-muted/30 text-muted-foreground",
            hasData && "hover:bg-primary/15 cursor-pointer",
            !hasData && "cursor-not-allowed",
          )}
          title={enabled ? "Nonaktifkan modul" : "Aktifkan modul"}
        >
          {enabled && hasData ? (
            <Check className="size-4" strokeWidth={2.5} />
          ) : (
            <Icon className="size-4 opacity-70" />
          )}
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg border",
              enabled && hasData
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>

          <span className="min-w-0 flex-1">
            <span className="text-foreground flex flex-wrap items-center gap-2 text-sm font-medium">
              {config.label}
              {!hasData ? (
                <Badge variant="outline" className="text-[10px]">
                  Belum ada data
                </Badge>
              ) : enabled ? (
                selectionCount != null && selectionCount > 0 ? (
                  <Badge variant="default" className="text-[10px]">
                    {selectionCount} dipilih
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    Auto
                  </Badge>
                )
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  Off
                </Badge>
              )}
            </span>
            <span className="text-muted-foreground mt-0.5 block truncate text-xs">
              {config.hint}
            </span>
          </span>
        </div>
      </div>

      {isOpen ? (
        <div className="border-border/60 space-y-3 border-t bg-muted/10 px-3 py-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function SourceTileList({
  items,
  selected,
  emptyHint,
  onToggle,
  onSelectAll,
  onClear,
}: {
  items: { id: string; label: string; meta: string }[];
  selected: string[];
  emptyHint: string;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClear: () => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground py-2 text-center text-xs">
        {emptyHint}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          Pilih sumber
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 px-2 text-[11px]"
            onClick={() => onSelectAll(items.map((i) => i.id))}
          >
            Semua
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 px-2 text-[11px]"
            disabled={selected.length === 0}
            onClick={onClear}
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="grid max-h-44 gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-2">
        {items.map((item) => {
          const isSelected = selected.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={cn(
                "group flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-all",
                isSelected
                  ? "border-primary/50 bg-primary/10 ring-1 ring-primary/20"
                  : "border-border/60 bg-background hover:border-primary/30 hover:bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background group-hover:border-primary/40",
                )}
              >
                {isSelected ? (
                  <Check className="size-2.5" strokeWidth={3} />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground line-clamp-2 text-xs font-medium leading-snug">
                  {item.label}
                </span>
                <span className="text-muted-foreground mt-0.5 block truncate text-[10px]">
                  {item.meta}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SingleSelectField({
  placeholder,
  items,
  value,
  onChange,
}: {
  placeholder: string;
  items: { id: string; label: string; meta: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground py-2 text-center text-xs">
        Belum ada data tersedia.
      </p>
    );
  }

  const selected = items.find((i) => i.id === value);

  return (
    <div className="space-y-2">
      <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
        Pilih sumber
      </span>
      <Select
        value={value || "__auto__"}
        items={[
          { value: "__auto__", label: placeholder },
          ...items.map((item) => ({ value: item.id, label: item.label })),
        ]}
        onValueChange={(v) => onChange(v === "__auto__" ? "" : (v ?? ""))}
      >
        <SelectTrigger className="bg-background h-10 w-full text-xs">
          {selected ? (
            <span className="flex min-w-0 flex-col items-start gap-0.5 py-0.5 text-left">
              <span className="text-foreground truncate font-medium">
                {selected.label}
              </span>
              <span className="text-muted-foreground truncate text-[10px]">
                {selected.meta}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__auto__">
            <span className="flex flex-col gap-0.5">
              <span>{placeholder}</span>
              <span className="text-muted-foreground text-[10px]">
                Rekomendasi berdasarkan kategori
              </span>
            </span>
          </SelectItem>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              <span className="flex flex-col gap-0.5">
                <span>{item.label}</span>
                <span className="text-muted-foreground text-[10px]">
                  {item.meta}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function UspModuleSummaryChips({
  modules,
  available,
}: {
  modules: ContextModuleToggles;
  available: ContextModuleToggles;
}) {
  const active = (Object.keys(MODULE_CONFIG) as ModuleKey[]).filter(
    (k) => modules[k] && available[k],
  );

  if (active.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Aktifkan minimal satu modul sumber data.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map((key) => {
        const Icon = MODULE_CONFIG[key].icon;
        return (
          <span
            key={key}
            className="border-primary/25 bg-primary/8 text-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
          >
            <Icon className="text-primary size-3" aria-hidden />
            {MODULE_CONFIG[key].short}
          </span>
        );
      })}
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  BarChart3,
  ImageIcon,
  MessageSquare,
  PackageSearch,
  Package,
  Radar,
  Search,
  Sparkles,
  Star,
  Target,
} from "lucide-react";
import type {
  StrategyGenerationConfig,
  StrategySourceCatalog,
  StrategySourceKey,
} from "@/lib/brand-research/strategy/evidence-types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BrandStrategyVisualSourceSection } from "@/components/brand-hub/brand-strategy-visual-source-section";
import { cn } from "@/lib/utils";

const SOURCE_META: Record<
  StrategySourceKey,
  { title: string; description: string; icon: typeof Star }
> = {
  review: {
    title: "Review Intel",
    description: "Keluhan & pujian konsumen dari review produk.",
    icon: Star,
  },
  social: {
    title: "Social Listening",
    description: "Pain point & wishlist dari monitor sosial.",
    icon: MessageSquare,
  },
  visual: {
    title: "Visual Library",
    description: "Referensi visual moodboard brand.",
    icon: ImageIcon,
  },
  competitor: {
    title: "Competitor Tracker",
    description: "Copy & positioning listing kompetitor.",
    icon: Target,
  },
  keyword: {
    title: "Keyword Intel",
    description: "Tema keyword untuk konteks segmentasi.",
    icon: Search,
  },
  trend: {
    title: "Trend Radar",
    description: "Sinyal tren kategori & visual.",
    icon: Radar,
  },
  usp: {
    title: "USP Analyzer",
    description: "Gap positioning & klaim over/under-used.",
    icon: BarChart3,
  },
  productDiscovery: {
    title: "Product Discovery",
    description: "Sinyal pasar dari pencarian produk kompetitor.",
    icon: PackageSearch,
  },
  competitorProduct: {
    title: "Competitor Products",
    description: "Benchmark produk rival individual yang dilacak.",
    icon: Package,
  },
};

type TabKey = "market" | "creative" | "intelligence";

const TAB_SOURCES: Record<TabKey, StrategySourceKey[]> = {
  market: ["review", "social"],
  creative: ["visual"],
  intelligence: ["competitor", "competitorProduct", "keyword", "trend", "usp", "productDiscovery"],
};

const TAB_META: Record<
  TabKey,
  { label: string; icon: typeof Star; hint: string }
> = {
  market: {
    label: "Market",
    icon: Star,
    hint: "Suara konsumen — wajib salah satu untuk generate.",
  },
  creative: {
    label: "Creative",
    icon: Sparkles,
    hint: "Visual brand — atau gunakan Competitor sebagai alternatif.",
  },
  intelligence: {
    label: "Intel",
    icon: Target,
    hint: "Konteks kompetitif & positioning.",
  },
};

function countEnabled(
  config: StrategyGenerationConfig,
  keys: StrategySourceKey[],
): number {
  return keys.filter((k) => config[k].enabled).length;
}

function SourceCard({
  sourceKey,
  items,
  selection,
  onToggleEnabled,
  onToggleId,
  onSelectAll,
  extra,
}: {
  sourceKey: StrategySourceKey;
  items: { id: string; label: string; detail?: string }[];
  selection: StrategyGenerationConfig[StrategySourceKey];
  onToggleEnabled: (enabled: boolean) => void;
  onToggleId: (id: string, checked: boolean) => void;
  onSelectAll: (all: boolean) => void;
  extra?: React.ReactNode;
}) {
  const meta = SOURCE_META[sourceKey];
  const Icon = meta.icon;
  const disabled = items.length === 0;
  const allSelected =
    items.length > 0 && items.every((i) => selection.ids.includes(i.id));

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-background/80 transition-colors",
        selection.enabled && !disabled
          ? "border-[color-mix(in_srgb,var(--lab-accent,var(--primary))_30%,transparent)] shadow-sm"
          : "border-border/50",
        disabled && "opacity-55",
      )}
    >
      <div className="flex items-start gap-3 border-b border-border/40 bg-muted/20 px-4 py-3">
        <Checkbox
          id={`src-${sourceKey}`}
          checked={selection.enabled && !disabled}
          disabled={disabled}
          onCheckedChange={(v) => onToggleEnabled(v === true)}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon className="text-muted-foreground size-4 shrink-0" />
            <Label htmlFor={`src-${sourceKey}`} className="text-sm font-semibold">
              {meta.title}
            </Label>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            {meta.description}
          </p>
        </div>
        {!disabled && selection.enabled ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 text-[10px]"
            onClick={() => onSelectAll(!allSelected)}
          >
            {allSelected ? "Kosongkan" : "Pilih semua"}
          </Button>
        ) : null}
      </div>

      <div className="px-4 py-3">
        {disabled ? (
          <p className="text-muted-foreground text-xs">Belum ada data di modul ini.</p>
        ) : (
          <ul className="max-h-36 space-y-1.5 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="hover:bg-muted/40 flex items-start gap-2.5 rounded-lg px-2 py-1.5"
              >
                <Checkbox
                  id={`${sourceKey}-${item.id}`}
                  checked={selection.enabled && selection.ids.includes(item.id)}
                  disabled={!selection.enabled}
                  onCheckedChange={(v) => onToggleId(item.id, v === true)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor={`${sourceKey}-${item.id}`}
                  className="min-w-0 flex-1 text-xs leading-snug font-normal"
                >
                  <span className="block truncate">{item.label}</span>
                  {item.detail ? (
                    <span className="text-muted-foreground block truncate text-[10px]">
                      {item.detail}
                    </span>
                  ) : null}
                </Label>
              </li>
            ))}
          </ul>
        )}
        {extra}
      </div>
    </article>
  );
}

export function BrandStrategySourcePicker({
  catalog,
  config,
  onChange,
  className,
}: {
  catalog: StrategySourceCatalog;
  config: StrategyGenerationConfig;
  onChange: (config: StrategyGenerationConfig) => void;
  className?: string;
}) {
  const [tab, setTab] = useState<TabKey>("market");

  function patch<K extends StrategySourceKey>(
    key: K,
    patchValue: Partial<StrategyGenerationConfig[K]>,
  ) {
    onChange({
      ...config,
      [key]: { ...config[key], ...patchValue },
    });
  }

  function itemsFor(key: StrategySourceKey) {
    if (key === "visual") return [];
    return catalog[key];
  }

  function renderSource(key: StrategySourceKey) {
    if (key === "visual") {
      return (
        <BrandStrategyVisualSourceSection
          key="visual"
          catalog={catalog.visual}
          visual={config.visual}
          onChange={(visual) => patch("visual", visual)}
        />
      );
    }

    const items = itemsFor(key);
    return (
      <SourceCard
        key={key}
        sourceKey={key}
        items={items}
        selection={config[key]}
        onToggleEnabled={(enabled) => patch(key, { enabled })}
        onToggleId={(id, checked) =>
          patch(key, {
            ids: checked
              ? [...new Set([...config[key].ids, id])]
              : config[key].ids.filter((x) => x !== id),
          })
        }
        onSelectAll={(all) =>
          patch(key, {
            ids: all ? items.map((i) => i.id) : [],
          })
        }
      />
    );
  }

  const enabledTotal = (Object.keys(SOURCE_META) as StrategySourceKey[]).filter(
    (k) => config[k].enabled,
  ).length;

  return (
    <section className={cn("bento-tile justify-start gap-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="bento-label">Sumber data untuk AI</span>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Pilih modul dan item spesifik yang dibaca AI saat generate. Minimum: Review
            atau Social + Visual (≥5 asset), atau Competitor.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tabular-nums",
            enabledTotal > 0
              ? "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_12%,transparent)] text-[var(--lab-accent,var(--primary))]"
              : "bg-muted text-muted-foreground",
          )}
        >
          {enabledTotal} modul aktif
        </span>
      </div>

      <div
        role="tablist"
        aria-label="Kategori sumber"
        className="flex flex-wrap gap-1 rounded-xl border border-border/50 bg-muted/20 p-1"
      >
        {(Object.keys(TAB_META) as TabKey[]).map((key) => {
          const meta = TAB_META[key];
          const TabIcon = meta.icon;
          const active = tab === key;
          const n = countEnabled(config, TAB_SOURCES[key]);
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:flex-none",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <TabIcon className="size-3.5 shrink-0" />
              {meta.label}
              {n > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    active
                      ? "bg-[color-mix(in_srgb,var(--lab-accent,var(--primary))_15%,transparent)] text-[var(--lab-accent,var(--primary))]"
                      : "bg-muted",
                  )}
                >
                  {n}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">{TAB_META[tab].hint}</p>

      <div className="grid gap-3">
        {TAB_SOURCES[tab].map((key) => renderSource(key))}
      </div>
    </section>
  );
}

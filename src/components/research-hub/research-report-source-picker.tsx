"use client";

import { useMemo } from "react";
import {
  BarChart3,
  Lightbulb,
  MessageSquare,
  Radar,
  Search,
  Sparkles,
  Star,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  ModuleSourceBox,
  SingleSelectField,
  SourceTileList,
} from "@/components/research-hub/usp-context-source-picker";
import type { ReportSourceOptions } from "@/lib/research/reports/list-report-source-options";
import type {
  ContextModuleToggles,
  ContextSourceIds,
} from "@/lib/research/usp-gap/context-types";

export type ReportModuleToggles = ContextModuleToggles & {
  uspAnalyzer: boolean;
  conceptLab: boolean;
};

export type ReportAvailableModules = ReportModuleToggles;

export type ReportSourceSelections = ContextSourceIds & {
  uspAnalysisId?: string;
  conceptId?: string;
};

type BaseModuleKey = keyof ContextModuleToggles;
type ExtraModuleKey = "uspAnalyzer" | "conceptLab";
type ReportModuleKey = BaseModuleKey | ExtraModuleKey;

const BASE_MODULE_CONFIG: Record<
  BaseModuleKey,
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
};

const EXTRA_MODULE_CONFIG: Record<
  ExtraModuleKey,
  { label: string; short: string; icon: LucideIcon; hint: string }
> = {
  uspAnalyzer: {
    label: "USP & Gap Analyzer",
    short: "USP",
    icon: BarChart3,
    hint: "Gap matrix & USP kandidat",
  },
  conceptLab: {
    label: "Concept Lab",
    short: "Konsep",
    icon: Lightbulb,
    hint: "Konsep produk tervalidasi",
  },
};

function toggleId(list: string[] | undefined, id: string): string[] {
  const current = list ?? [];
  return current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id];
}

function selectionCount(
  key: ReportModuleKey,
  selections: ReportSourceSelections,
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
    case "uspAnalyzer":
      return selections.uspAnalysisId ? 1 : 0;
    case "conceptLab":
      return selections.conceptId ? 1 : 0;
    default:
      return 0;
  }
}

export function ReportModuleSummaryChips({
  modules,
  available,
}: {
  modules: ReportModuleToggles;
  available: ReportAvailableModules;
}) {
  const allKeys: ReportModuleKey[] = [
    "reviewIntel",
    "competitor",
    "trendRadar",
    "keywordIntel",
    "socialListening",
    "uspAnalyzer",
    "conceptLab",
  ];
  const config = { ...BASE_MODULE_CONFIG, ...EXTRA_MODULE_CONFIG };
  const active = allKeys.filter((k) => modules[k] && available[k]);

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
        const Icon = config[key].icon;
        return (
          <span
            key={key}
            className="border-primary/25 bg-primary/8 text-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
          >
            <Icon className="text-primary size-3" aria-hidden />
            {config[key].short}
          </span>
        );
      })}
    </div>
  );
}

export function ResearchReportSourcePicker({
  options,
  available,
  modules,
  selections,
  onToggleModule,
  onSelectionsChange,
}: {
  options: ReportSourceOptions;
  available: ReportAvailableModules;
  modules: ReportModuleToggles;
  selections: ReportSourceSelections;
  onToggleModule: (key: ReportModuleKey) => void;
  onSelectionsChange: (next: ReportSourceSelections) => void;
}) {
  const enabledCount = useMemo(
    () =>
      (
        [
          "reviewIntel",
          "competitor",
          "trendRadar",
          "keywordIntel",
          "socialListening",
          "uspAnalyzer",
          "conceptLab",
        ] as ReportModuleKey[]
      ).filter((k) => modules[k] && available[k]).length,
    [modules, available],
  );

  const renderBaseModule = (key: BaseModuleKey) => {
    const config = BASE_MODULE_CONFIG[key];
    const Icon = config.icon;
    const enabled = !!modules[key];
    const hasData = !!available[key];
    const isOpen = enabled && hasData;

    return (
      <ModuleSourceBox
        key={key}
        config={config}
        icon={Icon}
        enabled={enabled}
        hasData={hasData}
        isOpen={isOpen}
        selectionCount={selectionCount(key, selections)}
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
              onSelectionsChange({ ...selections, reviewSourceIds: ids })
            }
            onClear={() =>
              onSelectionsChange({ ...selections, reviewSourceIds: [] })
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
              onSelectionsChange({ ...selections, competitorIds: ids })
            }
            onClear={() =>
              onSelectionsChange({ ...selections, competitorIds: [] })
            }
          />
        ) : null}
        {key === "trendRadar" ? (
          <SingleSelectField
            placeholder="Digest terbaru (auto)"
            items={options.digests}
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
            placeholder="Query terbaru (auto)"
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
            placeholder="Monitor terbaru (auto)"
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
      </ModuleSourceBox>
    );
  };

  const renderExtraModule = (key: ExtraModuleKey) => {
    const config = EXTRA_MODULE_CONFIG[key];
    const Icon = config.icon;
    const enabled = !!modules[key];
    const hasData = !!available[key];
    const isOpen = enabled && hasData;
    const items =
      key === "uspAnalyzer" ? options.uspAnalyses : options.concepts;
    const value =
      key === "uspAnalyzer"
        ? (selections.uspAnalysisId ?? "")
        : (selections.conceptId ?? "");

    return (
      <ModuleSourceBox
        key={key}
        config={config}
        icon={Icon}
        enabled={enabled}
        hasData={hasData}
        isOpen={isOpen}
        selectionCount={selectionCount(key, selections)}
        onToggle={() => onToggleModule(key)}
      >
        <SingleSelectField
          placeholder="Terbaru (auto)"
          items={items}
          value={value}
          onChange={(id) =>
            onSelectionsChange({
              ...selections,
              ...(key === "uspAnalyzer"
                ? { uspAnalysisId: id || undefined }
                : { conceptId: id || undefined }),
            })
          }
        />
      </ModuleSourceBox>
    );
  };

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
        {(Object.keys(BASE_MODULE_CONFIG) as BaseModuleKey[]).map(renderBaseModule)}
        {(Object.keys(EXTRA_MODULE_CONFIG) as ExtraModuleKey[]).map(
          renderExtraModule,
        )}
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

export function defaultReportModules(
  available: ReportAvailableModules,
): ReportModuleToggles {
  return {
    reviewIntel: available.reviewIntel,
    competitor: available.competitor,
    trendRadar: available.trendRadar,
    keywordIntel: available.keywordIntel,
    socialListening: available.socialListening,
    uspAnalyzer: available.uspAnalyzer,
    conceptLab: available.conceptLab,
  };
}

export function reportSelectionsToConfig(
  modules: ReportModuleToggles,
  selections: ReportSourceSelections,
): Record<string, string> {
  const sources: Record<string, string> = {};
  if (modules.reviewIntel && selections.reviewSourceIds?.[0]) {
    sources.reviewSourceId = selections.reviewSourceIds[0];
  }
  if (modules.competitor && selections.competitorIds?.[0]) {
    sources.competitorId = selections.competitorIds[0];
  }
  if (modules.trendRadar && selections.trendDigestId) {
    sources.digestId = selections.trendDigestId;
  }
  if (modules.keywordIntel && selections.keywordQueryId) {
    sources.keywordQueryId = selections.keywordQueryId;
  }
  if (modules.socialListening && selections.socialMonitorId) {
    sources.socialMonitorId = selections.socialMonitorId;
  }
  if (modules.uspAnalyzer && selections.uspAnalysisId) {
    sources.uspAnalysisId = selections.uspAnalysisId;
  }
  if (modules.conceptLab && selections.conceptId) {
    sources.conceptId = selections.conceptId;
  }
  return sources;
}

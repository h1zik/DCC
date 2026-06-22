/** Client-safe helpers for granular Visual Library selection in Brand Strategy. */

import type {
  StrategyGenerationConfig,
  StrategySourceCatalog,
  StructuredSourceRef,
} from "@/lib/brand-research/strategy/evidence-types";

export const VISUAL_ID_LEGACY = "visual-library";
export const VISUAL_ID_MANUAL = "manual";

export type StrategyVisualCatalogItem = {
  id: string;
  label: string;
  count: number;
  detail?: string;
};

export type StrategyVisualCatalog = {
  assetCount: number;
  pinterest: StrategyVisualCatalogItem[];
  competitor: StrategyVisualCatalogItem[];
  social: StrategyVisualCatalogItem[];
  manualCount: number;
};

export function visualPinterestId(collectionId: string): string {
  return `pinterest:${collectionId}`;
}

export function visualCompetitorId(competitorId: string): string {
  return `competitor:${competitorId}`;
}

export function visualSocialId(monitorId: string): string {
  return `social:${monitorId}`;
}

export function allVisualSourceIds(catalog: StrategyVisualCatalog): string[] {
  return [
    ...catalog.pinterest.map((p) => visualPinterestId(p.id)),
    ...catalog.competitor.map((c) => visualCompetitorId(c.id)),
    ...catalog.social.map((s) => visualSocialId(s.id)),
    ...(catalog.manualCount > 0 ? [VISUAL_ID_MANUAL] : []),
  ];
}

export function usesLegacyVisualSelection(ids: string[]): boolean {
  return ids.length === 0 || ids.includes(VISUAL_ID_LEGACY);
}

export function countSelectedVisualAssets(
  catalog: StrategyVisualCatalog,
  visual: StrategyGenerationConfig["visual"],
): number {
  if (!visual.enabled) return 0;
  if (usesLegacyVisualSelection(visual.ids)) return catalog.assetCount;

  let total = 0;
  const ids = new Set(visual.ids);
  for (const p of catalog.pinterest) {
    if (ids.has(visualPinterestId(p.id))) total += p.count;
  }
  for (const c of catalog.competitor) {
    if (ids.has(visualCompetitorId(c.id))) total += c.count;
  }
  for (const s of catalog.social) {
    if (ids.has(visualSocialId(s.id))) total += s.count;
  }
  if (ids.has(VISUAL_ID_MANUAL)) total += catalog.manualCount;
  return total;
}

/** Expand legacy `visual-library` id to explicit source ids. */
export function normalizeVisualSelection(
  visual: StrategyGenerationConfig["visual"],
  catalog: StrategyVisualCatalog,
): StrategyGenerationConfig["visual"] {
  if (!usesLegacyVisualSelection(visual.ids)) return visual;
  return {
    ...visual,
    ids: allVisualSourceIds(catalog),
  };
}

export function normalizeStrategyGenerationConfig(
  config: StrategyGenerationConfig,
  catalog: StrategySourceCatalog,
): StrategyGenerationConfig {
  return {
    ...config,
    productDiscovery: config.productDiscovery ?? {
      enabled: catalog.productDiscovery.length > 0,
      ids: catalog.productDiscovery.map((q) => q.id),
    },
    visual: normalizeVisualSelection(config.visual, catalog.visual),
  };
}

export function defaultVisualSourceIds(catalog: StrategyVisualCatalog): string[] {
  return allVisualSourceIds(catalog);
}

export function buildVisualSourceRefs(
  visual: StrategyGenerationConfig["visual"],
  catalog: StrategyVisualCatalog,
  brandQs: string,
): StructuredSourceRef[] {
  if (!visual.enabled) return [];

  const href = `/brand-hub/visual-library${brandQs}`;
  const refs: StructuredSourceRef[] = [];
  const ids = usesLegacyVisualSelection(visual.ids)
    ? allVisualSourceIds(catalog)
    : visual.ids;

  for (const id of ids) {
    if (id === VISUAL_ID_MANUAL) {
      if (catalog.manualCount > 0) {
        refs.push({
          module: "visual-library",
          sourceId: id,
          label: `Manual (${catalog.manualCount} asset)`,
          href,
        });
      }
      continue;
    }
    if (id.startsWith("pinterest:")) {
      const item = catalog.pinterest.find((p) => visualPinterestId(p.id) === id);
      if (item && item.count > 0) {
        refs.push({
          module: "visual-library",
          sourceId: id,
          label: `Pinterest: ${item.label} (${item.count})`,
          href,
        });
      }
      continue;
    }
    if (id.startsWith("competitor:")) {
      const item = catalog.competitor.find((c) => visualCompetitorId(c.id) === id);
      if (item && item.count > 0) {
        refs.push({
          module: "visual-library",
          sourceId: id,
          label: `Competitor: ${item.label} (${item.count})`,
          href,
        });
      }
      continue;
    }
    if (id.startsWith("social:")) {
      const item = catalog.social.find((s) => visualSocialId(s.id) === id);
      if (item && item.count > 0) {
        refs.push({
          module: "visual-library",
          sourceId: id,
          label: `Social: ${item.label} (${item.count})`,
          href,
        });
      }
    }
  }

  return refs;
}

import "server-only";

import { BrandVisualAssetSource } from "@prisma/client";
import type { StrategyGenerationConfig } from "@/lib/brand-research/strategy/evidence-types";
import type { listBrandVisualAssets } from "@/lib/brand-research/visual";
import {
  usesLegacyVisualSelection,
  VISUAL_ID_MANUAL,
} from "@/lib/brand-research/strategy/strategy-visual-config";

type VisualAssetRow = Awaited<ReturnType<typeof listBrandVisualAssets>>[number];

export function filterBrandVisualAssetsForStrategy(
  assets: VisualAssetRow[],
  visual: StrategyGenerationConfig["visual"],
): VisualAssetRow[] {
  if (!visual.enabled) return [];
  if (usesLegacyVisualSelection(visual.ids)) return assets;

  const ids = new Set(visual.ids);
  const pinterestIds = new Set(
    visual.ids
      .filter((id) => id.startsWith("pinterest:"))
      .map((id) => id.slice("pinterest:".length)),
  );
  const competitorIds = new Set(
    visual.ids
      .filter((id) => id.startsWith("competitor:"))
      .map((id) => id.slice("competitor:".length)),
  );
  const socialIds = new Set(
    visual.ids
      .filter((id) => id.startsWith("social:"))
      .map((id) => id.slice("social:".length)),
  );
  const manualEnabled = ids.has(VISUAL_ID_MANUAL);

  return assets.filter((a) => {
    if (a.source === BrandVisualAssetSource.PINTEREST && a.collectionId) {
      return pinterestIds.has(a.collectionId);
    }
    if (a.source === BrandVisualAssetSource.COMPETITOR_LISTING) {
      const meta = a.metadata as { competitorId?: string } | null;
      return Boolean(meta?.competitorId && competitorIds.has(meta.competitorId));
    }
    if (a.source === BrandVisualAssetSource.SOCIAL) {
      const meta = a.metadata as { monitorId?: string } | null;
      return Boolean(meta?.monitorId && socialIds.has(meta.monitorId));
    }
    if (a.source === BrandVisualAssetSource.MANUAL) {
      return manualEnabled;
    }
    return false;
  });
}

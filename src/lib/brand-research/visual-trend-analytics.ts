import "server-only";

import { prisma } from "@/lib/prisma";
import {
  computeDominantPaletteFromAssets,
  type ComputedPalette,
} from "@/lib/brand-research/visual";
import { brandStudioBrandFilter } from "@/lib/brand-research/brand-studio-scope";

export type VisualTrendCollectionAnalytics = {
  id: string;
  name: string;
  keywords: string[];
  assetCount: number;
  lastAssetAt: string | null;
  topTags: { tag: string; count: number }[];
  palette: ComputedPalette | null;
};

function countTags(tagsList: string[][]): { tag: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const tags of tagsList) {
    for (const tag of tags) {
      const key = tag.trim().toLowerCase();
      if (!key) continue;
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag, count]) => ({ tag, count }));
}

export async function buildVisualTrendAnalytics(
  _userId: string,
  ownerBrandId?: string | null,
): Promise<VisualTrendCollectionAnalytics[]> {
  const collections = await prisma.brandVisualCollection.findMany({
    where: brandStudioBrandFilter(ownerBrandId),
    orderBy: { updatedAt: "desc" },
    include: {
      assets: {
        where: { source: "PINTEREST" },
        select: {
          tags: true,
          dominantColors: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return collections.map((c) => {
    const lastAsset = c.assets[0];
    return {
      id: c.id,
      name: c.name,
      keywords: c.keywords,
      assetCount: c.assets.length,
      lastAssetAt: lastAsset?.createdAt.toISOString() ?? null,
      topTags: countTags(c.assets.map((a) => a.tags)),
      palette: computeDominantPaletteFromAssets(c.assets),
    };
  });
}

import type { ResearchMarketplace } from "@prisma/client";

export type ProductDiscoveryScrapeState = {
  marketplaces: ResearchMarketplace[];
  nextIndex: number;
  warnings: string[];
  /** TikTok kulqiz: pass 2 crawl subkategori jika pass 1 tidak cukup. */
  tiktokKulqizExpandSubcategories?: boolean;
};

export function parseProductDiscoveryScrapeState(
  raw: unknown,
  fallbackMarketplaces: ResearchMarketplace[],
): ProductDiscoveryScrapeState {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const marketplaces = Array.isArray(o.marketplaces)
      ? (o.marketplaces as ResearchMarketplace[])
      : fallbackMarketplaces;
    const nextIndex =
      typeof o.nextIndex === "number" && o.nextIndex >= 0
        ? Math.floor(o.nextIndex)
        : 0;
    const warnings = Array.isArray(o.warnings)
      ? o.warnings.filter((w): w is string => typeof w === "string")
      : [];
    return {
      marketplaces,
      nextIndex,
      warnings,
      tiktokKulqizExpandSubcategories: o.tiktokKulqizExpandSubcategories === true,
    };
  }

  return {
    marketplaces:
      fallbackMarketplaces.length > 0
        ? fallbackMarketplaces
        : (["SHOPEE"] as ResearchMarketplace[]),
    nextIndex: 0,
    warnings: [],
  };
}

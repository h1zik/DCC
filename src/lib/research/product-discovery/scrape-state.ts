import type { ResearchMarketplace } from "@prisma/client";
import type { ScrapeDataProvider } from "@/lib/research/scrape-data-provider";

export type ProductDiscoveryScrapeState = {
  marketplaces: ResearchMarketplace[];
  nextIndex: number;
  warnings: string[];
  /** Sumber scrape per marketplace (VPS vs Apify). */
  sources?: Partial<Record<ResearchMarketplace, ScrapeDataProvider>>;
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
    const sourcesRaw = o.sources;
    const sources =
      sourcesRaw && typeof sourcesRaw === "object" && !Array.isArray(sourcesRaw)
        ? (sourcesRaw as Partial<Record<ResearchMarketplace, ScrapeDataProvider>>)
        : undefined;

    return {
      marketplaces,
      nextIndex,
      warnings,
      sources,
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

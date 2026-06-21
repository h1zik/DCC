import type { DataProvenanceEntry, ScrapeDataProvider } from "@/lib/research/scrape-data-provider";

export type PinterestCollectionSourceConfig = {
  pendingScrapeKeywords?: string[];
  keywordProviders?: Partial<Record<string, ScrapeDataProvider>>;
  scrapedAt?: string;
};

export function parsePinterestCollectionSourceConfig(
  raw: unknown,
): PinterestCollectionSourceConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;

  const pending = o.pendingScrapeKeywords;
  const keywordProvidersRaw = o.keywordProviders;

  const keywordProviders =
    keywordProvidersRaw &&
    typeof keywordProvidersRaw === "object" &&
    !Array.isArray(keywordProvidersRaw)
      ? (Object.fromEntries(
          Object.entries(keywordProvidersRaw as Record<string, unknown>).filter(
            ([, value]) =>
              value === "vps" ||
              value === "apify" ||
              value === "demo" ||
              value === "native",
          ),
        ) as Partial<Record<string, ScrapeDataProvider>>)
      : undefined;

  return {
    pendingScrapeKeywords: Array.isArray(pending)
      ? pending
          .filter((k): k is string => typeof k === "string")
          .map((k) => k.trim())
          .filter(Boolean)
      : undefined,
    keywordProviders,
    scrapedAt: typeof o.scrapedAt === "string" ? o.scrapedAt : undefined,
  };
}

export function buildPinterestDataProvenance(
  keywordProviders?: Partial<Record<string, ScrapeDataProvider>>,
): DataProvenanceEntry[] {
  const entries = Object.entries(keywordProviders ?? {}).filter(
    (entry): entry is [string, ScrapeDataProvider] =>
      entry[1] === "vps" ||
      entry[1] === "apify" ||
      entry[1] === "demo" ||
      entry[1] === "native",
  );

  if (entries.length === 0) {
    return [{ label: "Pinterest", provider: "demo" }];
  }

  const byProvider = new Map<ScrapeDataProvider, string[]>();
  for (const [keyword, provider] of entries) {
    const list = byProvider.get(provider) ?? [];
    list.push(keyword);
    byProvider.set(provider, list);
  }

  return [...byProvider.entries()].map(([provider, keywords]) => ({
    label:
      keywords.length === 1
        ? `Pinterest · ${keywords[0]}`
        : `Pinterest · ${keywords.length} keyword`,
    provider,
    isFallback: provider === "apify",
  }));
}

export function parsePinterestCollectionProvenance(
  raw: unknown,
): DataProvenanceEntry[] {
  const config = parsePinterestCollectionSourceConfig(raw);
  return buildPinterestDataProvenance(config.keywordProviders);
}

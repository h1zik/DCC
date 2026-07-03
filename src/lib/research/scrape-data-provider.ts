/** JSON key on SocialListeningBatch.platformStatus for scrape provider map. */
export const PLATFORM_STATUS_PROVIDERS_KEY = "__providers";

/** Where marketplace / social scrape data was fetched from. */
export type ScrapeDataProvider =
  | "vps"
  | "apify"
  | "native"
  | "dataforseo"
  | "google_trends"
  | "demo"
  | "csv"
  | "internal";

export type DataProvenanceEntry = {
  /** Human label, e.g. "Shopee Search" or "TikTok". */
  label: string;
  provider: ScrapeDataProvider;
  /** True when Apify was used as fallback while VPS is expected. */
  isFallback?: boolean;
};

const PROVIDER_LABELS: Record<ScrapeDataProvider, string> = {
  vps: "VPS",
  apify: "Apify",
  native: "Native",
  dataforseo: "DataForSEO",
  google_trends: "Google Trends",
  demo: "Demo",
  csv: "CSV",
  internal: "Internal DCC",
};

export function scrapeProviderLabel(provider: ScrapeDataProvider): string {
  return PROVIDER_LABELS[provider];
}

export function isApifyFallbackProvider(entry: DataProvenanceEntry): boolean {
  return entry.provider === "apify" || entry.isFallback === true;
}

export function providerBadgeTone(
  provider: ScrapeDataProvider,
  isFallback?: boolean,
): "default" | "warning" | "muted" | "danger" {
  // Demo = data fabrikasi — harus mencolok, bukan abu-abu yang mudah terlewat.
  if (provider === "demo") return "danger";
  if (provider === "apify" || isFallback) return "warning";
  return "default";
}

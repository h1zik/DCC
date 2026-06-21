import type {
  DataProvenanceEntry,
  ScrapeDataProvider,
} from "@/lib/research/scrape-data-provider";
import type {
  KeywordSignalStats,
  NormalizedKeywordSignal,
} from "@/lib/research/keyword-intel/keyword-signal-types";

function shopeeAutocompleteProvider(
  signals: NormalizedKeywordSignal[],
): ScrapeDataProvider {
  if (signals.some((s) => s.source === "shopee_autocomplete_apify")) {
    return "apify";
  }
  if (signals.some((s) => s.source === "shopee_autocomplete")) {
    return "vps";
  }
  return "apify";
}

export function buildKeywordDataProvenance(input: {
  signals: NormalizedKeywordSignal[];
  stats: KeywordSignalStats;
}): DataProvenanceEntry[] {
  const { signals, stats } = input;
  const entries: DataProvenanceEntry[] = [];

  if (stats.external.shopee > 0) {
    const provider = shopeeAutocompleteProvider(signals);
    entries.push({
      label: "Shopee Autocomplete",
      provider,
      isFallback: provider === "apify",
    });
  }

  if (stats.external.tokopedia > 0) {
    entries.push({
      label: "Tokopedia Autocomplete",
      provider: "native",
    });
  }

  if (stats.external.googleTrends > 0) {
    entries.push({
      label: "Google Trends",
      provider: "google_trends",
    });
  }

  if (stats.external.dataforseo > 0) {
    entries.push({
      label: "Volume Google",
      provider: "dataforseo",
    });
  }

  if (stats.external.shopeeSearch > 0) {
    entries.push({
      label: "Shopee Search",
      provider: "vps",
    });
  }

  if (stats.internal.competitor > 0) {
    entries.push({
      label: "Competitor Tracker",
      provider: "internal",
    });
  }

  if (stats.internal.reviewIntel > 0) {
    entries.push({
      label: "Review Intelligence",
      provider: "internal",
    });
  }

  if (stats.internal.socialListening > 0) {
    entries.push({
      label: "Social Listening",
      provider: "internal",
    });
  }

  return entries;
}

import "server-only";

import {
  isScraperApiConfigured,
  loadAllVpsRunItems,
  startVpsActorRun,
} from "@/lib/scraper-api/client";

export type ShopeeAutocompleteSuggestion = {
  keyword: string;
  rank?: number;
  suggestionType?: string;
  sourceKeyword?: string;
};

function pickSuggestionKeyword(item: Record<string, unknown>): string {
  for (const key of ["suggestion", "keyword", "query"]) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/** Actor `shopee-autocomplete` di VPS — keyword suggestions untuk Keyword Intel. */
export async function fetchShopeeAutocompleteViaVps(
  query: string,
): Promise<ShopeeAutocompleteSuggestion[]> {
  if (!isScraperApiConfigured() || !query.trim()) return [];

  const run = await startVpsActorRun(
    "shopee-autocomplete",
    { keyword: query.trim() },
    { wait: true, timeout: 120, throwOnFailed: false },
  );

  if (run.status === "failed") {
    throw new Error(run.error ?? "Shopee autocomplete VPS gagal.");
  }

  const items = await loadAllVpsRunItems(run);
  const seen = new Set<string>();
  const hits: ShopeeAutocompleteSuggestion[] = [];

  for (const item of items) {
    const kw = pickSuggestionKeyword(item);
    if (!kw) continue;
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    hits.push({
      keyword: kw,
      rank: typeof item.rank === "number" ? item.rank : undefined,
      suggestionType:
        typeof item.suggestion_type === "string"
          ? item.suggestion_type
          : undefined,
      sourceKeyword:
        typeof item.input_keyword === "string"
          ? item.input_keyword
          : undefined,
    });
  }

  return hits;
}

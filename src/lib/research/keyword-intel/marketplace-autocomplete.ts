import "server-only";

import { fetchShopeeAutocompleteViaApify } from "@/lib/apify/shopee-autocomplete";

export type AutocompleteHit = {
  keyword: string;
  source: string;
  rank?: number;
  suggestionType?: string;
};

async function fetchShopeeSuggestions(query: string): Promise<AutocompleteHit[]> {
  const hits = await fetchShopeeAutocompleteViaApify(query, "id");
  return hits.map((h) => ({
    keyword: h.keyword,
    source: "shopee_autocomplete_apify",
    rank: h.rankPosition,
  }));
}

/** Keyword Intel: Shopee autocomplete only. */
export async function fetchMarketplaceAutocomplete(
  query: string,
): Promise<AutocompleteHit[]> {
  return fetchShopeeSuggestions(query);
}

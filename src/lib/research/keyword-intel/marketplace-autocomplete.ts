import "server-only";

import { fetchShopeeAutocompleteViaApify } from "@/lib/apify/shopee-autocomplete";
import { isScraperApiConfigured } from "@/lib/scraper-api/client";
import { fetchShopeeAutocompleteViaVps } from "@/lib/scraper-api/shopee-autocomplete";

export type AutocompleteHit = {
  keyword: string;
  source: string;
  rank?: number;
  suggestionType?: string;
};

async function fetchShopeeSuggestions(query: string): Promise<AutocompleteHit[]> {
  if (isScraperApiConfigured()) {
    try {
      const vpsHits = await fetchShopeeAutocompleteViaVps(query);
      if (vpsHits.length > 0) {
        return vpsHits.map((h) => ({
          keyword: h.keyword,
          source: "shopee_autocomplete",
          rank: h.rank,
          suggestionType: h.suggestionType,
        }));
      }
    } catch (err) {
      console.warn(
        "[marketplace-autocomplete] Shopee VPS gagal — fallback Apify",
        err,
      );
    }
  }

  const apifyHits = await fetchShopeeAutocompleteViaApify(query, "id");
  if (apifyHits.length > 0) {
    return apifyHits.map((h) => ({
      keyword: h.keyword,
      source: "shopee_autocomplete_apify",
      rank: h.rankPosition,
    }));
  }

  return [];
}

/** Keyword Intel: Shopee autocomplete only. */
export async function fetchMarketplaceAutocomplete(
  query: string,
): Promise<AutocompleteHit[]> {
  return fetchShopeeSuggestions(query);
}

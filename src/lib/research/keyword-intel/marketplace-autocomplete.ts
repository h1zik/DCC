import "server-only";

import { fetchShopeeAutocompleteViaApify } from "@/lib/apify/shopee-autocomplete";

export type AutocompleteHit = {
  keyword: string;
  source: string;
};

async function fetchShopeeSuggestionsDirect(query: string): Promise<string[]> {
  try {
    const url = `https://shopee.co.id/api/v4/search/search_suggestion?keyword=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      suggestions?: { keyword?: string }[];
    };
    return (json.suggestions ?? [])
      .map((s) => s.keyword?.trim())
      .filter((k): k is string => !!k);
  } catch (err) {
    console.warn("[marketplace-autocomplete] Shopee direct gagal", err);
    return [];
  }
}

async function fetchShopeeSuggestions(query: string): Promise<AutocompleteHit[]> {
  const apifyHits = await fetchShopeeAutocompleteViaApify(query, "id");
  if (apifyHits.length > 0) {
    return apifyHits.map((h) => ({
      keyword: h.keyword,
      source: "shopee_autocomplete_apify",
    }));
  }

  const direct = await fetchShopeeSuggestionsDirect(query);
  return direct.map((keyword) => ({
    keyword,
    source: "shopee_autocomplete",
  }));
}

/** Keyword Intel: Shopee autocomplete only. */
export async function fetchMarketplaceAutocomplete(
  query: string,
): Promise<AutocompleteHit[]> {
  return fetchShopeeSuggestions(query);
}

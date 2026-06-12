import "server-only";

import { ResearchMarketplace } from "@prisma/client";

export type AutocompleteHit = {
  keyword: string;
  source: string;
};

async function fetchShopeeSuggestions(query: string): Promise<string[]> {
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
    console.warn("[marketplace-autocomplete] Shopee gagal", err);
    return [];
  }
}

async function fetchTokopediaSuggestions(query: string): Promise<string[]> {
  try {
    const res = await fetch("https://gql.tokopedia.com/", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify([
        {
          operationName: "SearchProductQuery",
          variables: {
            params: query,
            device: "desktop",
            source: "search_autocomplete",
          },
          query: `query SearchProductQuery($params: String!) {
            searchProduct(params: $params) {
              data { keyword }
            }
          }`,
        },
      ]),
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      data?: { searchProduct?: { data?: { keyword?: string }[] } };
    }[];
    const items = json[0]?.data?.searchProduct?.data ?? [];
    return items
      .map((i) => i.keyword?.trim())
      .filter((k): k is string => !!k);
  } catch (err) {
    console.warn("[marketplace-autocomplete] Tokopedia gagal", err);
    return [];
  }
}

export async function fetchMarketplaceAutocomplete(
  query: string,
  marketplace?: ResearchMarketplace | null,
): Promise<AutocompleteHit[]> {
  const hits: AutocompleteHit[] = [];

  const fetchers: Promise<void>[] = [];

  if (!marketplace || marketplace === ResearchMarketplace.SHOPEE) {
    fetchers.push(
      fetchShopeeSuggestions(query).then((keywords) => {
        for (const k of keywords) {
          hits.push({ keyword: k, source: "shopee_autocomplete" });
        }
      }),
    );
  }

  if (!marketplace || marketplace === ResearchMarketplace.TOKOPEDIA) {
    fetchers.push(
      fetchTokopediaSuggestions(query).then((keywords) => {
        for (const k of keywords) {
          hits.push({ keyword: k, source: "tokopedia_autocomplete" });
        }
      }),
    );
  }

  await Promise.allSettled(fetchers);
  return hits;
}

import "server-only";

import {
  fetchApifyDataset,
  isApifyConfigured,
  startApifyActor,
  waitForApifyRun,
} from "@/lib/apify/client";

const DEFAULT_ACTOR = "xtracto~shopee-search-hint";

export function getShopeeAutocompleteActorId(): string | null {
  if (!isApifyConfigured()) return null;
  return (
    process.env.APIFY_ACTOR_SHOPEE_AUTOCOMPLETE?.trim() || DEFAULT_ACTOR
  );
}

/** xtracto/shopee-search-hint — country lowercase (`id`, `sg`, …). */
export function buildShopeeAutocompleteInput(
  keyword: string,
  country = "id",
): Record<string, unknown> {
  return {
    country: country.toLowerCase(),
    keyword: keyword.trim(),
  };
}

export type ShopeeAutocompleteHit = {
  keyword: string;
  rankPosition?: number;
  sourceKeyword?: string;
};

export async function fetchShopeeAutocompleteViaApify(
  query: string,
  country = "id",
): Promise<ShopeeAutocompleteHit[]> {
  const actorId = getShopeeAutocompleteActorId();
  if (!actorId || !query.trim()) return [];

  try {
    const { runId } = await startApifyActor(
      actorId,
      buildShopeeAutocompleteInput(query, country),
    );
    const { status, datasetId } = await waitForApifyRun(runId, {
      maxWaitMs: 120_000,
      pollIntervalMs: 3_000,
    });

    if (status !== "SUCCEEDED") {
      console.warn("[shopee-autocomplete-apify] run status:", status);
      return [];
    }

    const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
    const seen = new Set<string>();
    const hits: ShopeeAutocompleteHit[] = [];

    for (const item of items) {
      const kw =
        typeof item.keyword === "string" ? item.keyword.trim() : "";
      if (!kw) continue;
      const key = kw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      hits.push({
        keyword: kw,
        rankPosition:
          typeof item.rank_position === "number"
            ? item.rank_position
            : undefined,
        sourceKeyword:
          typeof item.source_keyword === "string"
            ? item.source_keyword
            : undefined,
      });
    }

    return hits;
  } catch (err) {
    console.warn("[shopee-autocomplete-apify] gagal", err);
    return [];
  }
}

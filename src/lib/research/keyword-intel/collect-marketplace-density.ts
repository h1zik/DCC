import "server-only";

import { ResearchMarketplace } from "@prisma/client";
import {
  buildSearchActorInput,
  getSearchActorId,
  isProductSearchConfigured,
} from "@/lib/apify/actors";
import {
  fetchApifyDataset,
  isApifyConfigured,
  startApifyActor,
  waitForApifyRun,
} from "@/lib/apify/client";
import { normalizeShopProducts } from "@/lib/apify/normalize";
import {
  signalId,
  type NormalizedKeywordSignal,
} from "@/lib/research/keyword-intel/keyword-signal-types";

export type MarketplaceDensityResult = {
  keyword: string;
  listingSampleCount: number;
  medianPrice: number | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

async function fetchShopeeDensity(
  keyword: string,
): Promise<MarketplaceDensityResult | null> {
  if (!isApifyConfigured() || !isProductSearchConfigured(ResearchMarketplace.SHOPEE)) {
    return null;
  }

  const actorId = getSearchActorId(ResearchMarketplace.SHOPEE);
  if (!actorId) return null;

  try {
    const input = buildSearchActorInput(ResearchMarketplace.SHOPEE, keyword, 24);
    const { runId } = await startApifyActor(actorId, input);
    const { status, datasetId } = await waitForApifyRun(runId, {
      maxWaitMs: 120_000,
      pollIntervalMs: 4_000,
    });
    if (status !== "SUCCEEDED") return null;

    const items = await fetchApifyDataset(datasetId);
    const products = normalizeShopProducts(items);
    const prices = products
      .map((p) => p.price)
      .filter((p): p is number => p != null && p > 0);

    return {
      keyword,
      listingSampleCount: products.length,
      medianPrice: median(prices),
    };
  } catch (err) {
    console.warn("[collect-marketplace-density] Shopee search gagal", keyword, err);
    return null;
  }
}

export async function collectMarketplaceDensity(input: {
  keywords: string[];
  enabled: boolean;
}): Promise<{
  densities: MarketplaceDensityResult[];
  signals: NormalizedKeywordSignal[];
}> {
  if (!input.enabled) {
    return { densities: [], signals: [] };
  }

  const top = input.keywords.slice(0, 10);
  const densities: MarketplaceDensityResult[] = [];
  const signals: NormalizedKeywordSignal[] = [];

  for (const keyword of top) {
    const density = await fetchShopeeDensity(keyword);
    if (!density) continue;
    densities.push(density);
    signals.push({
      signalId: signalId("shopee_search", keyword, "listing_sample_count"),
      source: "shopee_search",
      keyword,
      metric: "listing_sample_count",
      value: density.listingSampleCount,
      listingSampleCount: density.listingSampleCount,
      medianPrice: density.medianPrice,
      meta: { medianPrice: density.medianPrice },
    });
  }

  return { densities, signals };
}

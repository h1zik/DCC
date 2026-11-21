import "server-only";

import type { ResearchMarketplace } from "@prisma/client";
import { buildSearchActorInput, getSearchActorId } from "@/lib/apify/actors";
import {
  fetchApifyDataset,
  isApifyConfigured,
  startApifyActor,
  waitForApifyRun,
} from "@/lib/apify/client";
import {
  extractApifyScrapeErrorMessage,
  normalizeShopProducts,
  type NormalizedShopProduct,
} from "@/lib/apify/normalize";

/**
 * Pencarian keyword marketplace lewat Apify yang menunggu sampai run selesai.
 * Untuk pemanggil yang butuh hasil langsung (Keyword Intel, SEO marketplace);
 * Product Discovery memakai alur start + poll sendiri karena run-nya lebih lama.
 *
 * Melempar error bila Apify/actor belum dikonfigurasi atau run gagal, supaya
 * pemanggil bisa membedakan "scrape gagal" dari "memang tidak ada listing".
 */
export async function searchMarketplaceViaApify(
  marketplace: ResearchMarketplace,
  keyword: string,
  limit: number,
  opts?: { maxWaitMs?: number },
): Promise<NormalizedShopProduct[]> {
  if (!isApifyConfigured()) {
    throw new Error("APIFY_API_TOKEN belum diset.");
  }
  const actorId = getSearchActorId(marketplace);
  if (!actorId) {
    throw new Error(`Actor search Apify untuk ${marketplace} belum dikonfigurasi.`);
  }

  const { runId } = await startApifyActor(
    actorId,
    buildSearchActorInput(marketplace, keyword, limit),
  );
  const { status, datasetId } = await waitForApifyRun(runId, {
    maxWaitMs: opts?.maxWaitMs ?? 120_000,
    pollIntervalMs: 4_000,
  });
  if (status !== "SUCCEEDED") {
    throw new Error(`Scrape ${marketplace} gagal (status Apify: ${status}).`);
  }

  const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
  const products = normalizeShopProducts(items);
  if (products.length === 0) {
    const actorError = extractApifyScrapeErrorMessage(items);
    if (actorError) throw new Error(actorError);
  }
  return products.slice(0, limit);
}

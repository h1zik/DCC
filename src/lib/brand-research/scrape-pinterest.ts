import "server-only";

import { after } from "next/server";

import {
  BrandVisualAssetSource,
  BrandVisualCollectionStatus,
  Prisma,
  ResearchScrapeJobStatus,
  ResearchScrapeJobType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildPinterestActorInput,
  getPinterestActorId,
  pinterestActorEnvHint,
} from "@/lib/apify/actors";
import {
  fetchApifyDataset,
  isApifyConfigured,
  startApifyActor,
  waitForApifyRun,
} from "@/lib/apify/client";
import {
  parsePinterestCollectionSourceConfig,
} from "@/lib/brand-research/pinterest-source-config";
import {
  generateDemoPinterestPins,
  normalizePinterestPins,
} from "@/lib/brand-research/normalize-pinterest";
import {
  isPinterestScrapeConfigured,
  resolvePinterestMaxPinsPerKeyword,
} from "@/lib/brand-research/pinterest-limits";
import { executeBrandPinterestScrapeJob } from "@/lib/brand-research/run-pinterest-job";
import type { NormalizedPinterestPin } from "@/lib/brand-research/normalize-pinterest";
import type { ScrapeDataProvider } from "@/lib/research/scrape-data-provider";
import { isScraperApiConfigured } from "@/lib/scraper-api/client";
import { fetchPinterestSearchViaVps } from "@/lib/scraper-api/pinterest-pins";
import { isDemoDataAllowed } from "@/lib/demo-data-policy";

export type PinterestScrapeMode = {
  /** Hapus semua pin sebelum scrape. Default: false (tambah/upsert). */
  replace?: boolean;
  /** Hanya scrape keyword ini; disimpan sementara di sourceConfig saat enqueue. */
  keywords?: string[];
};

type CollectionSourceConfig = {
  pendingScrapeKeywords?: string[];
  keywordProviders?: Partial<Record<string, ScrapeDataProvider>>;
  scrapedAt?: string;
};

function parseCollectionSourceConfig(raw: unknown): CollectionSourceConfig {
  return parsePinterestCollectionSourceConfig(raw);
}

function persistPinterestProvenance(
  keywordProviders: Partial<Record<string, ScrapeDataProvider>>,
): object {
  return {
    keywordProviders,
    scrapedAt: new Date().toISOString(),
  };
}

function pinRecordMetadata(
  pin: NormalizedPinterestPin,
  sourceKeyword?: string,
): object {
  const base =
    typeof pin.metadata === "object" && pin.metadata != null ? pin.metadata : {};
  return sourceKeyword ? { ...base, sourceKeyword } : (base as object);
}

async function upsertPinterestPin(
  collectionId: string,
  collection: { ownerBrandId: string | null; keywords: string[] },
  pin: NormalizedPinterestPin,
  sourceKeyword?: string,
): Promise<void> {
  const existing = await prisma.brandVisualAsset.findFirst({
    where: {
      collectionId,
      source: BrandVisualAssetSource.PINTEREST,
      externalId: pin.externalId,
    },
  });
  const meta = pinRecordMetadata(pin, sourceKeyword);
  if (existing) {
    await prisma.brandVisualAsset.update({
      where: { id: existing.id },
      data: {
        imageUrl: pin.imageUrl,
        thumbnailUrl: pin.thumbnailUrl,
        title: pin.title,
        description: pin.description,
        sourceUrl: pin.sourceUrl,
        dominantColors: pin.dominantColor ? [pin.dominantColor] : undefined,
        metadata: meta,
      },
    });
    return;
  }
  await prisma.brandVisualAsset.create({
    data: {
      collectionId,
      ownerBrandId: collection.ownerBrandId,
      source: BrandVisualAssetSource.PINTEREST,
      externalId: pin.externalId,
      imageUrl: pin.imageUrl,
      thumbnailUrl: pin.thumbnailUrl,
      title: pin.title,
      description: pin.description,
      sourceUrl: pin.sourceUrl,
      dominantColors: pin.dominantColor ? [pin.dominantColor] : undefined,
      metadata: meta,
      tags: sourceKeyword ? [sourceKeyword] : collection.keywords,
    },
  });
}

async function finalizePinterestCollection(
  collectionId: string,
  importedCount: number,
  partialErrors?: string[],
  keywordProviders?: Partial<Record<string, ScrapeDataProvider>>,
): Promise<void> {
  const existingAssetCount = await prisma.brandVisualAsset.count({
    where: { collectionId },
  });
  const warning =
    partialErrors && partialErrors.length > 0
      ? `Sebagian keyword gagal: ${partialErrors.join("; ")}`
      : null;

  if (importedCount === 0 && existingAssetCount === 0) {
    const partial = warning ? ` Detail: ${warning}.` : "";
    await prisma.brandVisualCollection.update({
      where: { id: collectionId },
      data: {
        status: BrandVisualCollectionStatus.FAILED,
        errorMessage: `Pinterest scrape selesai tetapi tidak ada pin valid.${partial}`,
        sourceConfig: keywordProviders
          ? persistPinterestProvenance(keywordProviders)
          : Prisma.DbNull,
      },
    });
    return;
  }

  await prisma.brandVisualCollection.update({
    where: { id: collectionId },
    data: {
      status: BrandVisualCollectionStatus.READY,
      errorMessage:
        importedCount === 0 && warning
          ? `Scrape selesai tanpa pin baru. ${warning}`
          : warning,
      sourceConfig: keywordProviders
        ? persistPinterestProvenance(keywordProviders)
        : Prisma.DbNull,
    },
  });
}

export async function ingestPinterestPins(
  collectionId: string,
  items: Record<string, unknown>[],
  opts?: {
    partialErrors?: string[];
    sourceKeyword?: string;
    finalize?: boolean;
  },
): Promise<number> {
  const collection = await prisma.brandVisualCollection.findUnique({
    where: { id: collectionId },
  });
  if (!collection) throw new Error("Koleksi visual tidak ditemukan.");

  const pins = normalizePinterestPins(items);
  const existingAssetCount = await prisma.brandVisualAsset.count({
    where: { collectionId },
  });

  if (pins.length === 0) {
    if (opts?.finalize === false) return 0;
    const partial =
      opts?.partialErrors && opts.partialErrors.length > 0
        ? ` Detail: ${opts.partialErrors.join("; ")}.`
        : "";
    if (existingAssetCount > 0) {
      await prisma.brandVisualCollection.update({
        where: { id: collectionId },
        data: {
          status: BrandVisualCollectionStatus.READY,
          errorMessage:
            opts?.partialErrors && opts.partialErrors.length > 0
              ? `Scrape selesai tanpa pin baru.${partial}`
              : null,
          sourceConfig: Prisma.DbNull,
        },
      });
      return 0;
    }
    await prisma.brandVisualCollection.update({
      where: { id: collectionId },
      data: {
        status: BrandVisualCollectionStatus.FAILED,
        errorMessage: `Pinterest scrape selesai tetapi tidak ada pin valid.${partial}`,
      },
    });
    return 0;
  }

  const sourceKeyword = opts?.sourceKeyword?.trim();
  let count = 0;
  for (const pin of pins) {
    await upsertPinterestPin(collectionId, collection, pin, sourceKeyword || undefined);
    count += 1;
  }

  if (opts?.finalize === false) {
    return count;
  }

  await finalizePinterestCollection(collectionId, count, opts?.partialErrors);
  return count;
}

async function runDemoPinterestScrape(
  collectionId: string,
  keywordsToScrape: string[],
): Promise<void> {
  const collection = await prisma.brandVisualCollection.findUnique({
    where: { id: collectionId },
  });
  if (!collection) return;

  const maxPerKeyword = resolvePinterestMaxPinsPerKeyword(collection);
  const keywordProviders: Partial<Record<string, ScrapeDataProvider>> = {};
  let count = 0;
  for (const keyword of keywordsToScrape) {
    keywordProviders[keyword] = "demo";
    const pins = generateDemoPinterestPins(keyword, maxPerKeyword);
    for (const pin of pins) {
      const existing = await prisma.brandVisualAsset.findFirst({
        where: {
          collectionId,
          source: BrandVisualAssetSource.PINTEREST,
          externalId: pin.externalId,
        },
      });
      if (existing) continue;
      await upsertPinterestPin(collectionId, collection, pin, keyword);
      count += 1;
    }
  }

  await finalizePinterestCollection(
    collectionId,
    count,
    undefined,
    keywordProviders,
  );
}

function resolveKeywordsToScrape(
  collection: { keywords: string[]; sourceConfig: unknown },
): string[] {
  const pending = parseCollectionSourceConfig(collection.sourceConfig)
    .pendingScrapeKeywords;
  const list = pending?.length ? pending : collection.keywords;
  return list.map((k) => k.trim()).filter(Boolean);
}

/** Scrape each keyword — VPS first, Apify fallback per keyword. */
export async function executeBrandPinterestScrape(
  collectionId: string,
): Promise<number> {
  const collection = await prisma.brandVisualCollection.findUnique({
    where: { id: collectionId },
  });
  if (!collection) throw new Error("Koleksi visual tidak ditemukan.");

  const keywords = resolveKeywordsToScrape(collection);
  if (keywords.length === 0) {
    throw new Error("Tambahkan minimal satu keyword Pinterest.");
  }

  if (!isPinterestScrapeConfigured()) {
    throw new Error(
      "Pinterest scraper belum dikonfigurasi (SCRAPER_API_URL atau APIFY_API_TOKEN).",
    );
  }

  const partialErrors: string[] = [];
  const keywordProviders: Partial<Record<string, ScrapeDataProvider>> = {};
  const maxPerKeyword = resolvePinterestMaxPinsPerKeyword(collection);
  let totalImported = 0;

  for (const keyword of keywords) {
    let keywordImported = false;

    if (isScraperApiConfigured()) {
      try {
        const vpsItems = await fetchPinterestSearchViaVps(keyword, maxPerKeyword);
        if (vpsItems.length > 0) {
          const batch = vpsItems.slice(0, maxPerKeyword);
          totalImported += await ingestPinterestPins(collectionId, batch, {
            sourceKeyword: keyword,
            finalize: false,
          });
          keywordProviders[keyword] = "vps";
          keywordImported = true;
          continue;
        }
        console.warn(
          `[pinterest/vps] kosong — fallback Apify`,
          keyword,
        );
      } catch (err) {
        console.warn(
          `[pinterest/vps] gagal — fallback Apify`,
          keyword,
          err,
        );
      }
    }

    if (keywordImported) continue;

    if (!isApifyConfigured()) {
      partialErrors.push(
        `"${keyword}": VPS kosong/gagal dan Apify tidak dikonfigurasi`,
      );
      continue;
    }

    const actorId = getPinterestActorId();
    if (!actorId) {
      partialErrors.push(`"${keyword}": ${pinterestActorEnvHint()}`);
      continue;
    }

    try {
      const { runId } = await startApifyActor(
        actorId,
        buildPinterestActorInput(keyword, maxPerKeyword),
      );
      const { status, datasetId } = await waitForApifyRun(runId);
      if (status !== "SUCCEEDED") {
        partialErrors.push(`"${keyword}": Apify run ${status}`);
        continue;
      }
      const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
      if (items.length === 0) {
        partialErrors.push(`"${keyword}": 0 hasil dari Apify`);
        continue;
      }
      const batch = items.slice(0, maxPerKeyword);
      totalImported += await ingestPinterestPins(collectionId, batch, {
        sourceKeyword: keyword,
        finalize: false,
      });
      keywordProviders[keyword] = "apify";
    } catch (err) {
      partialErrors.push(
        `"${keyword}": ${err instanceof Error ? err.message : "scrape gagal"}`,
      );
    }
  }

  await finalizePinterestCollection(
    collectionId,
    totalImported,
    partialErrors.length > 0 ? partialErrors : undefined,
    keywordProviders,
  );

  const assetCount = await prisma.brandVisualAsset.count({ where: { collectionId } });
  if (assetCount === 0) {
    throw new Error("Tidak ada pin yang berhasil diimpor.");
  }

  return totalImported;
}

export async function enqueueBrandPinterestScrape(
  collectionId: string,
  mode: PinterestScrapeMode = {},
): Promise<void> {
  const collection = await prisma.brandVisualCollection.findUnique({
    where: { id: collectionId },
  });
  if (!collection) throw new Error("Koleksi visual tidak ditemukan.");
  if (collection.keywords.length === 0) {
    throw new Error("Tambahkan minimal satu keyword Pinterest.");
  }

  const keywordsToScrape =
    mode.keywords?.map((k) => k.trim()).filter(Boolean) ??
    resolveKeywordsToScrape(collection);

  if (keywordsToScrape.length === 0) {
    throw new Error("Tidak ada keyword untuk di-scrape.");
  }

  if (mode.replace) {
    await prisma.brandVisualAsset.deleteMany({ where: { collectionId } });
  }

  await prisma.brandVisualCollection.update({
    where: { id: collectionId },
    data: {
      status: BrandVisualCollectionStatus.COLLECTING,
      errorMessage: null,
      sourceConfig: { pendingScrapeKeywords: keywordsToScrape },
    },
  });

  if (!isPinterestScrapeConfigured()) {
    if (!isDemoDataAllowed()) {
      await prisma.brandVisualCollection.update({
        where: { id: collectionId },
        data: {
          status: BrandVisualCollectionStatus.FAILED,
          errorMessage:
            "Pinterest scraper (VPS atau Apify) belum dikonfigurasi. " +
            "Data demo dinonaktifkan di produksi (set ALLOW_DEMO_DATA=true untuk mengaktifkan).",
        },
      });
      return;
    }
    after(async () => {
      try {
        await runDemoPinterestScrape(collectionId, keywordsToScrape);
      } catch (err) {
        console.error("[enqueueBrandPinterestScrape] demo", collectionId, err);
      }
    });
    return;
  }

  const existingActiveJob = await prisma.brandResearchScrapeJob.findFirst({
    where: {
      entityId: collectionId,
      type: ResearchScrapeJobType.PINTEREST_SCRAPE,
      status: {
        in: [ResearchScrapeJobStatus.PENDING, ResearchScrapeJobStatus.RUNNING],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const job =
    existingActiveJob ??
    (await prisma.brandResearchScrapeJob.create({
      data: {
        type: ResearchScrapeJobType.PINTEREST_SCRAPE,
        entityId: collectionId,
        status: ResearchScrapeJobStatus.PENDING,
        startedAt: new Date(),
        totalSteps: keywordsToScrape.length,
        currentStep: 0,
        stepLabel: keywordsToScrape[0] ?? null,
      },
    }));

  after(async () => {
    try {
      await executeBrandPinterestScrapeJob(job.id);
    } catch (err) {
      console.error("[enqueueBrandPinterestScrape]", job.id, err);
    }
  });
}

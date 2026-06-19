import "server-only";

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
  generateDemoPinterestPins,
  normalizePinterestPins,
} from "@/lib/brand-research/normalize-pinterest";
import { resolvePinterestMaxPinsPerKeyword } from "@/lib/brand-research/pinterest-limits";
import { runBrandPinterestJobToCompletion } from "@/lib/brand-research/run-pinterest-job";
import type { NormalizedPinterestPin } from "@/lib/brand-research/normalize-pinterest";

export type PinterestScrapeMode = {
  /** Hapus semua pin sebelum scrape. Default: false (tambah/upsert). */
  replace?: boolean;
  /** Hanya scrape keyword ini; disimpan sementara di sourceConfig saat enqueue. */
  keywords?: string[];
};

type CollectionSourceConfig = {
  pendingScrapeKeywords?: string[];
};

function parseCollectionSourceConfig(raw: unknown): CollectionSourceConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const pending = (raw as CollectionSourceConfig).pendingScrapeKeywords;
  return {
    pendingScrapeKeywords: Array.isArray(pending)
      ? pending
          .filter((k): k is string => typeof k === "string")
          .map((k) => k.trim())
          .filter(Boolean)
      : undefined,
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
        sourceConfig: Prisma.DbNull,
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
      sourceConfig: Prisma.DbNull,
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
  let count = 0;
  for (const keyword of keywordsToScrape) {
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

  await finalizePinterestCollection(collectionId, count);
}

function resolveKeywordsToScrape(
  collection: { keywords: string[]; sourceConfig: unknown },
): string[] {
  const pending = parseCollectionSourceConfig(collection.sourceConfig)
    .pendingScrapeKeywords;
  const list = pending?.length ? pending : collection.keywords;
  return list.map((k) => k.trim()).filter(Boolean);
}

/** Scrape each keyword via Apify (actor expects one `search` per run). */
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

  const actorId = getPinterestActorId();
  if (!actorId) throw new Error(pinterestActorEnvHint());

  const partialErrors: string[] = [];
  const maxPerKeyword = resolvePinterestMaxPinsPerKeyword(collection);
  let totalImported = 0;

  for (const keyword of keywords) {
    try {
      const { runId } = await startApifyActor(
        actorId,
        buildPinterestActorInput(keyword, maxPerKeyword),
      );
      const { status, datasetId } = await waitForApifyRun(runId);
      if (status !== "SUCCEEDED") {
        partialErrors.push(`"${keyword}": run ${status}`);
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

  if (!isApifyConfigured()) {
    await runDemoPinterestScrape(collectionId, keywordsToScrape);
    return;
  }

  const job = await prisma.brandResearchScrapeJob.create({
    data: {
      type: ResearchScrapeJobType.PINTEREST_SCRAPE,
      entityId: collectionId,
      status: ResearchScrapeJobStatus.RUNNING,
      startedAt: new Date(),
      totalSteps: keywordsToScrape.length,
      currentStep: 0,
      stepLabel: keywordsToScrape[0] ?? null,
    },
  });

  await runBrandPinterestJobToCompletion(job.id);
}

export async function pollBrandPinterestScrapeJob(jobId: string): Promise<void> {
  const job = await prisma.brandResearchScrapeJob.findUnique({ where: { id: jobId } });
  if (!job || job.type !== ResearchScrapeJobType.PINTEREST_SCRAPE) return;
  if (job.status !== ResearchScrapeJobStatus.RUNNING) return;

  try {
    await executeBrandPinterestScrape(job.entityId);
    await prisma.brandResearchScrapeJob.update({
      where: { id: jobId },
      data: {
        status: ResearchScrapeJobStatus.COMPLETED,
        completedAt: new Date(),
        error: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pinterest scrape gagal.";
    await prisma.brandResearchScrapeJob.update({
      where: { id: jobId },
      data: {
        status: ResearchScrapeJobStatus.FAILED,
        error: message,
        completedAt: new Date(),
      },
    });
  }
}

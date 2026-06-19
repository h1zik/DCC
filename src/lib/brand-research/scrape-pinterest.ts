import "server-only";

import {
  BrandVisualAssetSource,
  BrandVisualCollectionStatus,
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
} from "@/lib/apify/client";
import {
  generateDemoPinterestPins,
  normalizePinterestPins,
} from "@/lib/brand-research/normalize-pinterest";
import { runBrandPinterestJobToCompletion } from "@/lib/brand-research/run-pinterest-job";

export async function ingestPinterestPins(
  collectionId: string,
  items: Record<string, unknown>[],
): Promise<number> {
  const collection = await prisma.brandVisualCollection.findUnique({
    where: { id: collectionId },
  });
  if (!collection) throw new Error("Koleksi visual tidak ditemukan.");

  const pins = normalizePinterestPins(items);
  if (pins.length === 0) return 0;

  let count = 0;
  for (const pin of pins) {
    const existing = await prisma.brandVisualAsset.findFirst({
      where: {
        collectionId,
        source: BrandVisualAssetSource.PINTEREST,
        externalId: pin.externalId,
      },
    });
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
          metadata: pin.metadata as object,
        },
      });
    } else {
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
          metadata: pin.metadata as object,
          tags: collection.keywords,
        },
      });
    }
    count += 1;
  }

  await prisma.brandVisualCollection.update({
    where: { id: collectionId },
    data: {
      status: BrandVisualCollectionStatus.READY,
      errorMessage: null,
    },
  });

  return count;
}

async function runDemoPinterestScrape(collectionId: string): Promise<void> {
  const collection = await prisma.brandVisualCollection.findUnique({
    where: { id: collectionId },
  });
  if (!collection) return;

  const pins = generateDemoPinterestPins(collection.keywords);
  for (const pin of pins) {
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
        metadata: pin.metadata as object,
        tags: collection.keywords,
      },
    });
  }

  await prisma.brandVisualCollection.update({
    where: { id: collectionId },
    data: { status: BrandVisualCollectionStatus.READY },
  });
}

export async function enqueueBrandPinterestScrape(collectionId: string): Promise<void> {
  const collection = await prisma.brandVisualCollection.findUnique({
    where: { id: collectionId },
  });
  if (!collection) throw new Error("Koleksi visual tidak ditemukan.");
  if (collection.keywords.length === 0) {
    throw new Error("Tambahkan minimal satu keyword Pinterest.");
  }

  await prisma.brandVisualAsset.deleteMany({ where: { collectionId } });
  await prisma.brandVisualCollection.update({
    where: { id: collectionId },
    data: {
      status: BrandVisualCollectionStatus.COLLECTING,
      errorMessage: null,
    },
  });

  if (!isApifyConfigured()) {
    await runDemoPinterestScrape(collectionId);
    return;
  }

  const actorId = getPinterestActorId();
  if (!actorId) {
    throw new Error(pinterestActorEnvHint());
  }

  const { runId } = await startApifyActor(
    actorId,
    buildPinterestActorInput(collection.keywords),
  );

  const job = await prisma.brandResearchScrapeJob.create({
    data: {
      type: ResearchScrapeJobType.PINTEREST_SCRAPE,
      entityId: collectionId,
      apifyRunId: runId,
      status: ResearchScrapeJobStatus.RUNNING,
      startedAt: new Date(),
    },
  });

  await runBrandPinterestJobToCompletion(job.id);
}

export async function pollBrandPinterestScrapeJob(jobId: string): Promise<void> {
  const job = await prisma.brandResearchScrapeJob.findUnique({ where: { id: jobId } });
  if (!job?.apifyRunId || job.type !== ResearchScrapeJobType.PINTEREST_SCRAPE) return;

  const { getApifyRunStatus } = await import("@/lib/apify/client");
  const { status, datasetId } = await getApifyRunStatus(job.apifyRunId);

  if (status === "RUNNING" || status === "READY") return;

  if (status === "SUCCEEDED") {
    const items = await fetchApifyDataset<Record<string, unknown>>(datasetId);
    await ingestPinterestPins(job.entityId, items);
    await prisma.brandResearchScrapeJob.update({
      where: { id: jobId },
      data: {
        status: ResearchScrapeJobStatus.COMPLETED,
        completedAt: new Date(),
        error: null,
      },
    });
    return;
  }

  const message = `Pinterest scrape gagal: ${status}`;
  await prisma.brandResearchScrapeJob.update({
    where: { id: jobId },
    data: {
      status: ResearchScrapeJobStatus.FAILED,
      error: message,
      completedAt: new Date(),
    },
  });
  await prisma.brandVisualCollection.update({
    where: { id: job.entityId },
    data: { status: BrandVisualCollectionStatus.FAILED, errorMessage: message },
  });
}

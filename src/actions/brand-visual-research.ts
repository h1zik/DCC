"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { BrandVisualAssetSource } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import { enqueueBrandPinterestScrape } from "@/lib/brand-research/scrape-pinterest";
import {
  harvestBrandCompetitorVisuals,
  listBrandVisualAssets,
  listBrandVisualCollections,
} from "@/lib/brand-research/visual";
import { resumeStuckBrandPinterestJobs } from "@/lib/brand-research/run-pinterest-job";
import { getPinterestMaxPinsPerKeyword } from "@/lib/apify/actors";

const createCollectionSchema = z.object({
  name: z.string().min(1).max(120),
  keywords: z.array(z.string().min(1).max(100)).min(1).max(10),
  ownerBrandId: z.string().optional().nullable(),
});

export async function createBrandVisualCollection(
  input: z.infer<typeof createCollectionSchema>,
) {
  const session = await requireBrandManager();
  const data = createCollectionSchema.parse(input);

  const collection = await prisma.brandVisualCollection.create({
    data: {
      name: data.name.trim(),
      keywords: data.keywords.map((k) => k.trim()),
      ownerBrandId: data.ownerBrandId ?? null,
      createdById: session.user.id,
    },
  });

  revalidatePath("/brand-hub/visual-library");
  return { id: collection.id };
}

export async function scrapeBrandVisualCollection(collectionId: string) {
  await requireBrandManager();
  z.string().min(1).parse(collectionId);

  after(async () => {
    try {
      await enqueueBrandPinterestScrape(collectionId);
    } catch (err) {
      console.error("[scrapeBrandVisualCollection]", err);
    }
  });

  revalidatePath("/brand-hub/visual-library");
}

export async function deleteBrandVisualCollection(collectionId: string) {
  await requireBrandManager();
  await prisma.brandVisualCollection.delete({ where: { id: collectionId } });
  revalidatePath("/brand-hub/visual-library");
}

export async function harvestCompetitorVisualsAction(competitorId: string) {
  const session = await requireBrandManager();
  const result = await harvestBrandCompetitorVisuals(competitorId, session.user.id);
  revalidatePath("/brand-hub/visual-library");
  return result;
}

export async function getBrandVisualLibraryData(ownerBrandId?: string | null) {
  const session = await requireBrandManager();
  await resumeStuckBrandPinterestJobs();

  const [collections, assets] = await Promise.all([
    listBrandVisualCollections(session.user.id, ownerBrandId),
    listBrandVisualAssets(session.user.id, ownerBrandId),
  ]);

  return {
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      keywords: c.keywords,
      status: c.status,
      ownerBrandId: c.ownerBrandId,
      assetCount: c._count.assets,
      errorMessage: c.errorMessage,
      updatedAt: c.updatedAt.toISOString(),
    })),
    assets: assets.map((a) => ({
      id: a.id,
      collectionId: a.collectionId,
      source: a.source,
      imageUrl: a.imageUrl,
      thumbnailUrl: a.thumbnailUrl,
      title: a.title,
      description: a.description,
      sourceUrl: a.sourceUrl,
      tags: a.tags,
      aestheticTags: a.aestheticTags,
      dominantColors: a.dominantColors,
      createdAt: a.createdAt.toISOString(),
    })),
    pinterestMaxPins: getPinterestMaxPinsPerKeyword(),
  };
}

export async function deleteBrandVisualAsset(assetId: string) {
  await requireBrandManager();
  await prisma.brandVisualAsset.delete({ where: { id: assetId } });
  revalidatePath("/brand-hub/visual-library");
}

export async function listBrandVisualAssetsBySource(
  source: BrandVisualAssetSource,
  ownerBrandId?: string | null,
) {
  const session = await requireBrandManager();
  const assets = await listBrandVisualAssets(session.user.id, ownerBrandId, source);
  return assets.map((a) => ({
    id: a.id,
    imageUrl: a.imageUrl,
    thumbnailUrl: a.thumbnailUrl,
    title: a.title,
    source: a.source,
  }));
}

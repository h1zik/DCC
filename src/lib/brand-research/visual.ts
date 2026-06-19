import "server-only";

import { BrandVisualAssetSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function harvestBrandCompetitorVisuals(
  competitorId: string,
  userId: string,
): Promise<{ harvested: number }> {
  const competitor = await prisma.brandCompetitor.findFirst({
    where: { id: competitorId, createdById: userId },
    include: {
      skus: {
        where: { imageUrl: { not: null } },
        take: 100,
      },
    },
  });
  if (!competitor) throw new Error("Kompetitor tidak ditemukan.");

  let harvested = 0;
  for (const sku of competitor.skus) {
    if (!sku.imageUrl) continue;
    const externalId = sku.externalId ?? sku.id;
    const existing = await prisma.brandVisualAsset.findFirst({
      where: {
        ownerBrandId: competitor.ownerBrandId,
        source: BrandVisualAssetSource.COMPETITOR_LISTING,
        externalId,
      },
    });
    if (existing) {
      await prisma.brandVisualAsset.update({
        where: { id: existing.id },
        data: {
          imageUrl: sku.imageUrl,
          title: sku.name,
          sourceUrl: sku.productUrl,
          metadata: {
            competitorId,
            skuId: sku.id,
            competitorName: competitor.name,
          },
        },
      });
    } else {
      await prisma.brandVisualAsset.create({
        data: {
          ownerBrandId: competitor.ownerBrandId,
          source: BrandVisualAssetSource.COMPETITOR_LISTING,
          externalId,
          imageUrl: sku.imageUrl,
          title: sku.name,
          sourceUrl: sku.productUrl,
          tags: [competitor.category, competitor.brand],
          metadata: {
            competitorId,
            skuId: sku.id,
            competitorName: competitor.name,
          },
        },
      });
    }
    harvested += 1;
  }

  return { harvested };
}

export async function listBrandVisualAssets(
  userId: string,
  ownerBrandId?: string | null,
  source?: BrandVisualAssetSource,
) {
  const competitors = await prisma.brandCompetitor.findMany({
    where: { createdById: userId },
    select: { id: true },
  });
  const competitorIds = new Set(competitors.map((c) => c.id));

  const fromCollections = await prisma.brandVisualAsset.findMany({
    where: {
      collection: { createdById: userId },
      ...(ownerBrandId ? { ownerBrandId } : {}),
      ...(source ? { source } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const competitorAssets = await prisma.brandVisualAsset.findMany({
    where: {
      collectionId: null,
      source: BrandVisualAssetSource.COMPETITOR_LISTING,
      ...(ownerBrandId ? { ownerBrandId } : {}),
      ...(source && source !== BrandVisualAssetSource.COMPETITOR_LISTING
        ? { source }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const filteredCompetitor = competitorAssets.filter((a) => {
    const meta = a.metadata as { competitorId?: string } | null;
    return meta?.competitorId && competitorIds.has(meta.competitorId);
  });

  const merged = [...fromCollections, ...filteredCompetitor];
  const seen = new Set<string>();
  const unique: typeof merged = [];
  for (const a of merged) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    unique.push(a);
  }
  return unique.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export async function listBrandVisualCollections(userId: string, ownerBrandId?: string | null) {
  return prisma.brandVisualCollection.findMany({
    where: {
      createdById: userId,
      ...(ownerBrandId ? { ownerBrandId } : {}),
    },
    include: { _count: { select: { assets: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

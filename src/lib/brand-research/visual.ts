import "server-only";

import { BrandVisualAssetSource, SocialListeningStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  VisualLibraryAssetView,
  VisualLibraryGroups,
} from "@/lib/brand-research/visual-library-types";
import { brandStudioBrandFilter } from "@/lib/brand-research/brand-studio-scope";
import { parsePinterestCollectionProvenance } from "@/lib/brand-research/pinterest-source-config";

export type { VisualLibraryAssetView, VisualLibraryGroups } from "@/lib/brand-research/visual-library-types";

const HARVEST_LIMIT = 100;

function engagementScore(likes: number, comments: number, views: number): number {
  return likes + comments + Math.floor(views / 100);
}

export async function harvestBrandCompetitorVisuals(
  competitorId: string,
  userId: string,
  ownerBrandId?: string | null,
): Promise<{ harvested: number }> {
  const competitor = await prisma.researchCompetitor.findUnique({
    where: { id: competitorId },
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
        ownerBrandId: ownerBrandId ?? null,
        source: BrandVisualAssetSource.COMPETITOR_LISTING,
        externalId,
      },
    });
    const metadata = {
      sourceHub: "research",
      competitorId,
      skuId: sku.id,
      competitorName: competitor.name,
    };
    if (existing) {
      await prisma.brandVisualAsset.update({
        where: { id: existing.id },
        data: {
          imageUrl: sku.imageUrl,
          title: sku.name,
          sourceUrl: sku.productUrl,
          metadata,
        },
      });
    } else {
      await prisma.brandVisualAsset.create({
        data: {
          ownerBrandId: ownerBrandId ?? null,
          source: BrandVisualAssetSource.COMPETITOR_LISTING,
          externalId,
          imageUrl: sku.imageUrl,
          title: sku.name,
          sourceUrl: sku.productUrl,
          tags: [competitor.category, competitor.brand],
          metadata,
        },
      });
    }
    harvested += 1;
  }

  return { harvested };
}

export async function harvestBrandCompetitorProductVisuals(
  categoryId: string,
  userId: string,
  ownerBrandId?: string | null,
): Promise<{ harvested: number }> {
  const category = await prisma.competitorProductCategory.findUnique({
    where: { id: categoryId },
    include: {
      tracks: {
        where: { isActive: true, imageUrl: { not: null } },
        take: 100,
      },
    },
  });
  if (!category) throw new Error("Kategori produk kompetitor tidak ditemukan.");

  let harvested = 0;
  for (const track of category.tracks) {
    if (!track.imageUrl) continue;
    const externalId = `product-track:${track.id}`;
    const existing = await prisma.brandVisualAsset.findFirst({
      where: {
        ownerBrandId: ownerBrandId ?? null,
        source: BrandVisualAssetSource.COMPETITOR_LISTING,
        externalId,
      },
    });
    const metadata = {
      sourceHub: "research",
      sourceType: "competitorProduct",
      categoryId,
      trackId: track.id,
      productName: track.name,
      brand: track.brand,
      categoryName: category.name,
    };
    if (existing) {
      await prisma.brandVisualAsset.update({
        where: { id: existing.id },
        data: {
          imageUrl: track.imageUrl,
          title: track.name,
          sourceUrl: track.productUrl,
          metadata,
        },
      });
    } else {
      await prisma.brandVisualAsset.create({
        data: {
          ownerBrandId: ownerBrandId ?? null,
          source: BrandVisualAssetSource.COMPETITOR_LISTING,
          externalId,
          imageUrl: track.imageUrl,
          title: track.name,
          sourceUrl: track.productUrl,
          tags: [category.name, track.brand ?? "kompetitor"].filter(Boolean),
          metadata,
        },
      });
    }
    harvested += 1;
  }

  return { harvested };
}

export async function harvestBrandSocialVisuals(
  monitorId: string,
  userId: string,
  ownerBrandId?: string | null,
): Promise<{ harvested: number }> {
  const monitor = await prisma.socialListeningMonitor.findUnique({
    where: { id: monitorId },
  });
  if (!monitor) throw new Error("Monitor social listening tidak ditemukan.");

  const batch = await prisma.socialListeningBatch.findFirst({
    where: {
      monitorId: monitor.id,
      status: SocialListeningStatus.READY,
    },
    orderBy: { createdAt: "desc" },
    include: {
      mentions: {
        where: { thumbnailUrl: { not: null } },
      },
    },
  });

  if (!batch) {
    throw new Error("Batch social listening belum READY — refresh monitor dulu.");
  }

  const mentions = [...batch.mentions]
    .sort(
      (a, b) =>
        engagementScore(b.likes, b.comments, b.views) -
        engagementScore(a.likes, a.comments, b.views),
    )
    .slice(0, HARVEST_LIMIT);

  if (mentions.length === 0) {
    throw new Error(
      "Tidak ada mention dengan thumbnail — refresh batch social setelah deploy ini.",
    );
  }

  let harvested = 0;
  for (const mention of mentions) {
    if (!mention.thumbnailUrl) continue;
    const externalId = `${mention.platform}:${mention.externalId ?? mention.id}`;
    const title =
      mention.author?.trim() ||
      mention.text.trim().slice(0, 80) ||
      "Social mention";

    const existing = await prisma.brandVisualAsset.findFirst({
      where: {
        ownerBrandId: ownerBrandId ?? null,
        source: BrandVisualAssetSource.SOCIAL,
        externalId,
      },
    });

    const assetData = {
      imageUrl: mention.thumbnailUrl,
      thumbnailUrl: mention.thumbnailUrl,
      title,
      description: mention.text.slice(0, 500),
      sourceUrl: mention.url,
      tags: [mention.platform, mention.classification],
      metadata: {
        sourceHub: "research",
        monitorId: monitor.id,
        batchId: batch.id,
        mentionId: mention.id,
        platform: mention.platform,
        isViral: mention.isViral,
        mediaType: mention.mediaType,
      },
    };

    if (existing) {
      await prisma.brandVisualAsset.update({
        where: { id: existing.id },
        data: assetData,
      });
    } else {
      await prisma.brandVisualAsset.create({
        data: {
          ownerBrandId: ownerBrandId ?? null,
          source: BrandVisualAssetSource.SOCIAL,
          externalId,
          ...assetData,
        },
      });
    }
    harvested += 1;
  }

  return { harvested };
}

export async function createManualBrandVisualAsset(input: {
  userId: string;
  ownerBrandId?: string | null;
  imageUrl: string;
  thumbnailUrl?: string | null;
  title?: string | null;
  description?: string | null;
  tags?: string[];
  externalId: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const asset = await prisma.brandVisualAsset.create({
    data: {
      ownerBrandId: input.ownerBrandId ?? null,
      source: BrandVisualAssetSource.MANUAL,
      externalId: input.externalId,
      imageUrl: input.imageUrl,
      thumbnailUrl: input.thumbnailUrl ?? null,
      title: input.title?.trim() || null,
      description: input.description?.trim() || null,
      tags: input.tags ?? [],
      metadata: {
        uploadedById: input.userId,
        ...(input.metadata ?? {}),
      },
    },
  });
  return { id: asset.id };
}

export async function listBrandVisualAssets(
  _userId: string,
  ownerBrandId?: string | null,
  source?: BrandVisualAssetSource,
) {
  const brandFilter = brandStudioBrandFilter(ownerBrandId);

  const [researchCompetitors, researchMonitors, productCategories] = await Promise.all([
    prisma.researchCompetitor.findMany({ select: { id: true } }),
    prisma.socialListeningMonitor.findMany({ select: { id: true } }),
    prisma.competitorProductCategory.findMany({ select: { id: true } }),
  ]);
  const competitorIds = new Set(researchCompetitors.map((c) => c.id));
  const monitorIds = new Set(researchMonitors.map((m) => m.id));
  const productCategoryIds = new Set(productCategories.map((c) => c.id));

  const fromCollections = await prisma.brandVisualAsset.findMany({
    where: {
      collectionId: { not: null },
      ...brandFilter,
      ...(source ? { source } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const competitorAssets =
    !source || source === BrandVisualAssetSource.COMPETITOR_LISTING
      ? await prisma.brandVisualAsset.findMany({
          where: {
            collectionId: null,
            source: BrandVisualAssetSource.COMPETITOR_LISTING,
            ...brandFilter,
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : [];

  const socialAssets =
    !source || source === BrandVisualAssetSource.SOCIAL
      ? await prisma.brandVisualAsset.findMany({
          where: {
            collectionId: null,
            source: BrandVisualAssetSource.SOCIAL,
            ...brandFilter,
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : [];

  const manualAssets =
    !source || source === BrandVisualAssetSource.MANUAL
      ? await prisma.brandVisualAsset.findMany({
          where: {
            collectionId: null,
            source: BrandVisualAssetSource.MANUAL,
            ...brandFilter,
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : [];

  const filteredCompetitor = competitorAssets.filter((a) => {
    const meta = a.metadata as {
      competitorId?: string;
      sourceType?: string;
      categoryId?: string;
    } | null;
    if (meta?.sourceType === "competitorProduct") {
      return Boolean(meta?.categoryId && productCategoryIds.has(meta.categoryId));
    }
    return meta?.competitorId && competitorIds.has(meta.competitorId);
  });

  const filteredSocial = socialAssets.filter((a) => {
    const meta = a.metadata as { monitorId?: string } | null;
    return meta?.monitorId && monitorIds.has(meta.monitorId);
  });

  const filteredManual = manualAssets;

  const merged = [
    ...fromCollections,
    ...filteredCompetitor,
    ...filteredSocial,
    ...filteredManual,
  ];
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

export type ComputedPalette = {
  primary: string;
  secondary: string;
  accent: string;
  neutrals: string[];
  sampleCount: number;
};

function normalizeHex(color: string): string {
  const c = color.trim().toUpperCase();
  if (!c.startsWith("#")) return `#${c}`;
  return c;
}

function parseDominantColors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is string => typeof c === "string");
}

/** Aggregate dominantColors from visual assets into a deterministic palette. */
export function computeDominantPaletteFromAssets(
  assets: { dominantColors: unknown }[],
): ComputedPalette | null {
  const freq = new Map<string, number>();
  for (const a of assets) {
    for (const raw of parseDominantColors(a.dominantColors)) {
      if (!raw?.trim()) continue;
      const hex = normalizeHex(raw);
      freq.set(hex, (freq.get(hex) ?? 0) + 1);
    }
  }

  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;

  const primary = sorted[0]![0];
  const secondary = sorted[1]?.[0] ?? primary;
  const accent = sorted[2]?.[0] ?? secondary;
  const neutrals = sorted.slice(3, 7).map(([hex]) => hex);
  const sampleCount = sorted.reduce((sum, [, n]) => sum + n, 0);

  return {
    primary,
    secondary,
    accent,
    neutrals: neutrals.length > 0 ? neutrals : [primary],
    sampleCount,
  };
}

export async function listBrandVisualCollections(
  _userId: string,
  ownerBrandId?: string | null,
) {
  return prisma.brandVisualCollection.findMany({
    where: brandStudioBrandFilter(ownerBrandId),
    include: { _count: { select: { assets: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

function toAssetView(
  a: Awaited<ReturnType<typeof listBrandVisualAssets>>[number],
): VisualLibraryAssetView {
  return {
    id: a.id,
    imageUrl: a.imageUrl,
    thumbnailUrl: a.thumbnailUrl,
    title: a.title,
    sourceUrl: a.sourceUrl,
    tags: a.tags,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function buildVisualLibraryGroups(
  userId: string,
  ownerBrandId?: string | null,
): Promise<VisualLibraryGroups> {
  const [collections, assets] = await Promise.all([
    listBrandVisualCollections(userId, ownerBrandId),
    listBrandVisualAssets(userId, ownerBrandId),
  ]);

  const pinterestByCollection = new Map<string, VisualLibraryAssetView[]>();
  const competitorBuckets = new Map<string, VisualLibraryAssetView[]>();
  const competitorProductBuckets = new Map<string, VisualLibraryAssetView[]>();
  const socialBuckets = new Map<string, VisualLibraryAssetView[]>();
  const manual: VisualLibraryAssetView[] = [];

  const competitorNameFromMeta = new Map<string, string>();
  const categoryNameFromMeta = new Map<string, string>();
  const monitorIds = new Set<string>();

  for (const a of assets) {
    const view = toAssetView(a);
    if (a.source === BrandVisualAssetSource.PINTEREST && a.collectionId) {
      const list = pinterestByCollection.get(a.collectionId) ?? [];
      list.push(view);
      pinterestByCollection.set(a.collectionId, list);
      continue;
    }
    if (a.source === BrandVisualAssetSource.COMPETITOR_LISTING) {
      const meta = a.metadata as {
        competitorId?: string;
        competitorName?: string;
        sourceType?: string;
        categoryId?: string;
        categoryName?: string;
      } | null;
      if (meta?.sourceType === "competitorProduct") {
        const catId = meta.categoryId ?? "_unknown";
        if (meta.categoryName) categoryNameFromMeta.set(catId, meta.categoryName);
        const list = competitorProductBuckets.get(catId) ?? [];
        list.push(view);
        competitorProductBuckets.set(catId, list);
        continue;
      }
      const cid = meta?.competitorId ?? "_unknown";
      if (meta?.competitorName) competitorNameFromMeta.set(cid, meta.competitorName);
      const list = competitorBuckets.get(cid) ?? [];
      list.push(view);
      competitorBuckets.set(cid, list);
      continue;
    }
    if (a.source === BrandVisualAssetSource.SOCIAL) {
      const meta = a.metadata as { monitorId?: string } | null;
      const mid = meta?.monitorId ?? "_unknown";
      monitorIds.add(mid);
      const list = socialBuckets.get(mid) ?? [];
      list.push(view);
      socialBuckets.set(mid, list);
      continue;
    }
    if (a.source === BrandVisualAssetSource.MANUAL) {
      manual.push(view);
    }
  }

  const competitorIds = [...competitorBuckets.keys()].filter((id) => id !== "_unknown");
  const productCategoryIds = [...competitorProductBuckets.keys()].filter(
    (id) => id !== "_unknown",
  );
  const [competitorRows, monitorRows, categoryRows] = await Promise.all([
    competitorIds.length > 0
      ? prisma.researchCompetitor.findMany({
          where: { id: { in: competitorIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    monitorIds.size > 0
      ? prisma.socialListeningMonitor.findMany({
          where: { id: { in: [...monitorIds] } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    productCategoryIds.length > 0
      ? prisma.competitorProductCategory.findMany({
          where: { id: { in: productCategoryIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const competitorNameById = new Map(competitorRows.map((c) => [c.id, c.name]));
  const monitorNameById = new Map(monitorRows.map((m) => [m.id, m.name]));
  const categoryNameById = new Map(categoryRows.map((c) => [c.id, c.name]));

  const pinterest = collections.map((c) => {
    let dataProvenance = parsePinterestCollectionProvenance(c.sourceConfig);
    if (
      dataProvenance.length === 1 &&
      dataProvenance[0]?.provider === "demo" &&
      c._count.assets > 0
    ) {
      dataProvenance = [
        {
          label: "Pinterest",
          provider: "apify",
          isFallback: true,
        },
      ];
    }
    return {
      collection: {
        id: c.id,
        name: c.name,
        keywords: c.keywords,
        status: c.status,
        assetCount: c._count.assets,
        errorMessage: c.errorMessage,
        maxPinsPerKeyword: c.maxPinsPerKeyword,
        dataProvenance,
      },
      assets: pinterestByCollection.get(c.id) ?? [],
    };
  });

  const competitors = [...competitorBuckets.entries()]
    .filter(([id]) => id !== "_unknown")
    .map(([competitorId, groupAssets]) => ({
      competitorId,
      name:
        competitorNameById.get(competitorId) ??
        competitorNameFromMeta.get(competitorId) ??
        "Kompetitor",
      assets: groupAssets,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const competitorProducts = [...competitorProductBuckets.entries()]
    .filter(([id]) => id !== "_unknown")
    .map(([categoryId, groupAssets]) => ({
      categoryId,
      name:
        categoryNameById.get(categoryId) ??
        categoryNameFromMeta.get(categoryId) ??
        "Kategori Produk",
      assets: groupAssets,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const socialMonitors = [...socialBuckets.entries()]
    .filter(([id]) => id !== "_unknown")
    .map(([monitorId, groupAssets]) => ({
      monitorId,
      name: monitorNameById.get(monitorId) ?? "Monitor (dihapus)",
      assets: groupAssets,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { pinterest, competitors, competitorProducts, socialMonitors, manual };
}

export async function deleteBrandVisualAssetForUser(
  assetId: string,
  _userId: string,
): Promise<void> {
  const asset = await prisma.brandVisualAsset.findUnique({
    where: { id: assetId },
  });
  if (!asset) throw new Error("Asset tidak ditemukan.");

  if (asset.collectionId) {
    const collection = await prisma.brandVisualCollection.findUnique({
      where: { id: asset.collectionId },
    });
    if (!collection) throw new Error("Asset tidak ditemukan.");
  } else if (asset.source === BrandVisualAssetSource.COMPETITOR_LISTING) {
    const meta = asset.metadata as {
      competitorId?: string;
      sourceType?: string;
      categoryId?: string;
    } | null;
    if (meta?.sourceType === "competitorProduct") {
      if (!meta.categoryId) throw new Error("Asset tidak ditemukan.");
      const category = await prisma.competitorProductCategory.findUnique({
        where: { id: meta.categoryId },
      });
      if (!category) throw new Error("Asset tidak ditemukan.");
    } else {
      if (!meta?.competitorId) throw new Error("Asset tidak ditemukan.");
      const competitor = await prisma.researchCompetitor.findUnique({
        where: { id: meta.competitorId },
      });
      if (!competitor) throw new Error("Asset tidak ditemukan.");
    }
  } else if (asset.source === BrandVisualAssetSource.SOCIAL) {
    const meta = asset.metadata as { monitorId?: string } | null;
    if (!meta?.monitorId) throw new Error("Asset tidak ditemukan.");
    const monitor = await prisma.socialListeningMonitor.findUnique({
      where: { id: meta.monitorId },
    });
    if (!monitor) throw new Error("Asset tidak ditemukan.");
  } else {
    throw new Error("Asset tidak ditemukan.");
  }

  await prisma.brandVisualAsset.delete({ where: { id: assetId } });
}

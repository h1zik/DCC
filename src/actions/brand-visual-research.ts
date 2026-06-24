"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { BrandVisualAssetSource } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import { enqueueBrandPinterestScrape } from "@/lib/brand-research/scrape-pinterest";
import {
  buildVisualLibraryGroups,
  createManualBrandVisualAsset,
  deleteBrandVisualAssetForUser,
  harvestBrandCompetitorVisuals,
  harvestBrandCompetitorProductVisuals,
  harvestBrandAdLibraryVisuals,
  harvestBrandSocialVisuals,
  listBrandVisualAssets,
} from "@/lib/brand-research/visual";
import { resumeStuckBrandPinterestJobs } from "@/lib/brand-research/run-pinterest-job";
import { getPinterestMaxPinsPerKeyword } from "@/lib/apify/actors";
import {
  clampPinterestMaxPins,
  PINTEREST_PINS_MAX,
  PINTEREST_PINS_MIN,
} from "@/lib/brand-research/pinterest-limits";
import {
  absolutePathFromStoredPublicPath,
  getUploadPublicDir,
} from "@/lib/upload-storage";

const BRAND_VISUAL_MAX_BYTES = 10 * 1024 * 1024;
const BRAND_VISUAL_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

const createCollectionSchema = z.object({
  name: z.string().min(1).max(120),
  keywords: z.array(z.string().min(1).max(100)).min(1).max(10),
  ownerBrandId: z.string().optional().nullable(),
  maxPinsPerKeyword: z
    .number()
    .int()
    .min(PINTEREST_PINS_MIN)
    .max(PINTEREST_PINS_MAX)
    .optional(),
});

const appendKeywordsSchema = z.object({
  collectionId: z.string().min(1),
  keywords: z.array(z.string().min(1).max(100)).min(1).max(10),
});

const scrapeCollectionSchema = z.object({
  collectionId: z.string().min(1),
  replace: z.boolean().optional(),
  keywords: z.array(z.string().min(1).max(100)).optional(),
});

const updatePinLimitSchema = z.object({
  collectionId: z.string().min(1),
  maxPinsPerKeyword: z
    .number()
    .int()
    .min(PINTEREST_PINS_MIN)
    .max(PINTEREST_PINS_MAX),
});

const createFromUrlSchema = z.object({
  imageUrl: z.string().url().max(2000),
  title: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string().min(1).max(80)).max(20).optional(),
  ownerBrandId: z.string().optional().nullable(),
});

function parseTags(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function createBrandVisualCollection(
  input: z.infer<typeof createCollectionSchema>,
) {
  const session = await requireBrandManager();
  const data = createCollectionSchema.parse(input);

  const collection = await prisma.brandVisualCollection.create({
    data: {
      name: data.name.trim(),
      keywords: data.keywords.map((k) => k.trim()),
      maxPinsPerKeyword: data.maxPinsPerKeyword
        ? clampPinterestMaxPins(data.maxPinsPerKeyword)
        : null,
      ownerBrandId: data.ownerBrandId ?? null,
      createdById: session.user.id,
    },
  });

  revalidatePath("/brand-hub/visual-library");
  return { id: collection.id };
}

export async function updateBrandVisualCollectionPinLimit(
  input: z.infer<typeof updatePinLimitSchema>,
) {
  await requireBrandManager();
  const data = updatePinLimitSchema.parse(input);

  await prisma.brandVisualCollection.update({
    where: { id: data.collectionId },
    data: { maxPinsPerKeyword: clampPinterestMaxPins(data.maxPinsPerKeyword) },
  });

  revalidatePath("/brand-hub/visual-library");
}

export async function scrapeBrandVisualCollection(
  input: z.infer<typeof scrapeCollectionSchema>,
) {
  await requireBrandManager();
  const data = scrapeCollectionSchema.parse(input);

  after(async () => {
    try {
      await enqueueBrandPinterestScrape(data.collectionId, {
        replace: data.replace ?? false,
        keywords: data.keywords,
      });
    } catch (err) {
      console.error("[scrapeBrandVisualCollection]", err);
    }
  });

  revalidatePath("/brand-hub/visual-library");
}

export async function appendBrandVisualCollectionKeywords(
  input: z.infer<typeof appendKeywordsSchema>,
) {
  const session = await requireBrandManager();
  const data = appendKeywordsSchema.parse(input);

  const collection = await prisma.brandVisualCollection.findFirst({
    where: { id: data.collectionId },
  });
  if (!collection) throw new Error("Koleksi tidak ditemukan.");

  const incoming = data.keywords.map((k) => k.trim()).filter(Boolean);
  const existingKeys = new Set(collection.keywords.map((k) => k.toLowerCase()));
  const toAdd = incoming.filter((k) => !existingKeys.has(k.toLowerCase()));
  if (toAdd.length === 0) {
    throw new Error("Keyword tersebut sudah ada di koleksi.");
  }
  if (collection.keywords.length + toAdd.length > 10) {
    throw new Error("Maksimal 10 keyword per koleksi.");
  }

  await prisma.brandVisualCollection.update({
    where: { id: collection.id },
    data: { keywords: [...collection.keywords, ...toAdd] },
  });

  after(async () => {
    try {
      await enqueueBrandPinterestScrape(collection.id, {
        replace: false,
        keywords: toAdd,
      });
    } catch (err) {
      console.error("[appendBrandVisualCollectionKeywords]", err);
    }
  });

  revalidatePath("/brand-hub/visual-library");
  return { added: toAdd };
}

export async function deleteBrandVisualCollection(collectionId: string) {
  await requireBrandManager();
  await prisma.brandVisualCollection.delete({ where: { id: collectionId } });
  revalidatePath("/brand-hub/visual-library");
}

export async function harvestCompetitorVisualsAction(
  competitorId: string,
  ownerBrandId?: string | null,
) {
  const session = await requireBrandManager();
  const result = await harvestBrandCompetitorVisuals(
    competitorId,
    session.user.id,
    ownerBrandId,
  );
  revalidatePath("/brand-hub/visual-library");
  revalidatePath("/brand-hub/competitor-tracker");
  return result;
}

export async function harvestCompetitorProductVisualsAction(
  categoryId: string,
  ownerBrandId?: string | null,
) {
  const session = await requireBrandManager();
  const result = await harvestBrandCompetitorProductVisuals(
    categoryId,
    session.user.id,
    ownerBrandId,
  );
  revalidatePath("/brand-hub/visual-library");
  revalidatePath("/brand-hub/competitor-tracker/products");
  revalidatePath(`/brand-hub/competitor-tracker/products/${categoryId}`);
  return result;
}

export async function harvestSocialVisualsAction(
  monitorId: string,
  ownerBrandId?: string | null,
) {
  const session = await requireBrandManager();
  const result = await harvestBrandSocialVisuals(
    monitorId,
    session.user.id,
    ownerBrandId,
  );
  revalidatePath("/brand-hub/visual-library");
  revalidatePath(`/brand-hub/social-listening/${monitorId}`);
  return result;
}

export async function harvestAdLibraryVisualsAction(
  monitorId: string,
  ownerBrandId?: string | null,
) {
  const session = await requireBrandManager();
  const result = await harvestBrandAdLibraryVisuals(
    monitorId,
    session.user.id,
    ownerBrandId,
  );
  revalidatePath("/brand-hub/visual-library");
  revalidatePath(`/brand-hub/ad-library/${monitorId}`);
  return result;
}

export async function createBrandVisualAssetFromUrl(
  input: z.infer<typeof createFromUrlSchema>,
) {
  const session = await requireBrandManager();
  const data = createFromUrlSchema.parse(input);

  if (!/^https?:\/\//i.test(data.imageUrl)) {
    throw new Error("URL gambar harus diawali http:// atau https://");
  }

  const slug = Buffer.from(data.imageUrl).toString("base64url").slice(0, 120);
  const result = await createManualBrandVisualAsset({
    userId: session.user.id,
    ownerBrandId: data.ownerBrandId ?? null,
    imageUrl: data.imageUrl,
    title: data.title,
    description: data.description,
    tags: data.tags ?? [],
    externalId: `url-${slug}`,
    metadata: { sourceKind: "url" },
  });

  revalidatePath("/brand-hub/visual-library");
  return result;
}

export async function uploadBrandVisualAsset(formData: FormData) {
  const session = await requireBrandManager();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Pilih file gambar.");
  }
  if (file.size > BRAND_VISUAL_MAX_BYTES) {
    throw new Error("Ukuran gambar maksimal 10 MB.");
  }
  const mime = file.type || "";
  if (!BRAND_VISUAL_MIMES.includes(mime as (typeof BRAND_VISUAL_MIMES)[number])) {
    throw new Error("Gunakan JPG, PNG, GIF, atau WebP.");
  }

  const title = String(formData.get("title") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const ownerBrandIdRaw = String(formData.get("ownerBrandId") ?? "").trim();
  const ownerBrandId = ownerBrandIdRaw || null;
  const tags = parseTags(String(formData.get("tags") ?? ""));

  const ext = extensionForMime(mime);
  const stored = `${randomUUID()}.${ext}`;
  const dir = path.join(getUploadPublicDir(), "brand-visual", session.user.id);
  await mkdir(dir, { recursive: true });
  const abs = path.join(dir, stored);
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));

  const publicPath = `/uploads/brand-visual/${session.user.id}/${stored}`;
  const result = await createManualBrandVisualAsset({
    userId: session.user.id,
    ownerBrandId,
    imageUrl: publicPath,
    thumbnailUrl: publicPath,
    title,
    description,
    tags,
    externalId: stored,
    metadata: { sourceKind: "upload", storedPath: publicPath },
  });

  revalidatePath("/brand-hub/visual-library");
  return result;
}

export async function getBrandVisualLibraryData(ownerBrandId?: string | null) {
  const session = await requireBrandManager();
  await resumeStuckBrandPinterestJobs();

  const groups = await buildVisualLibraryGroups(session.user.id, ownerBrandId);
  const totalAssetCount =
    groups.pinterest.reduce((n, p) => n + p.assets.length, 0) +
    groups.competitors.reduce((n, c) => n + c.assets.length, 0) +
    groups.competitorProducts.reduce((n, c) => n + c.assets.length, 0) +
    groups.socialMonitors.reduce((n, s) => n + s.assets.length, 0) +
    groups.adLibraryMonitors.reduce((n, m) => n + m.assets.length, 0) +
    groups.manual.length;

  return {
    groups,
    totalAssetCount,
    pinterestMaxPins: getPinterestMaxPinsPerKeyword(),
    pinterestPinsMin: PINTEREST_PINS_MIN,
    pinterestPinsMax: PINTEREST_PINS_MAX,
  };
}

export async function deleteBrandVisualAsset(assetId: string) {
  const session = await requireBrandManager();
  const asset = await prisma.brandVisualAsset.findUnique({
    where: { id: assetId },
    select: { source: true, metadata: true },
  });

  await deleteBrandVisualAssetForUser(assetId, session.user.id);

  if (asset?.source === BrandVisualAssetSource.MANUAL) {
    const meta = asset.metadata as { storedPath?: string } | null;
    const storedPath = meta?.storedPath;
    if (storedPath?.startsWith("/uploads/brand-visual/")) {
      try {
        const abs = absolutePathFromStoredPublicPath(storedPath);
        if (abs) {
          const { unlink } = await import("node:fs/promises");
          await unlink(abs);
        }
      } catch {
        /* best effort */
      }
    }
  }

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

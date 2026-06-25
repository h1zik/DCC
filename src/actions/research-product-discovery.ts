"use server";

import { revalidatePath } from "next/cache";
import { ResearchMarketplace } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import { enqueueProductDiscoveryScrape } from "@/lib/research/scrape-product-discovery";
import { pollProductDiscoveryInProgress } from "@/lib/research/run-product-discovery-job";
import { enqueueReviewScrape } from "@/lib/research/scrape-review-source";
import {
  isReviewPlatformConfigured,
  marketplaceForPlatformKey,
  validateReviewPlatformUrl,
} from "@/lib/review-platforms/registry";
import { platformKeyFromMarketplace } from "@/lib/review-platforms/platforms";
import {
  MAX_PRODUCT_LIMIT,
  MIN_PRODUCT_LIMIT,
} from "@/lib/research/product-discovery/constants";
import {
  addCompetitorProductTrack,
  createCompetitorProductCategory,
} from "@/actions/research-competitor-product";

const createQuerySchema = z.object({
  keyword: z.string().min(1).max(120),
  marketplaces: z
    .array(z.nativeEnum(ResearchMarketplace))
    .min(1, "Pilih minimal satu marketplace"),
  productLimit: z
    .number()
    .int()
    .min(MIN_PRODUCT_LIMIT)
    .max(MAX_PRODUCT_LIMIT),
});

export async function createProductDiscoveryQuery(
  input: z.infer<typeof createQuerySchema>,
) {
  const session = await requireMarketAnalyst();
  const data = createQuerySchema.parse(input);

  const query = await prisma.productDiscoveryQuery.create({
    data: {
      keyword: data.keyword.trim(),
      marketplaces: data.marketplaces,
      productLimit: data.productLimit,
      createdById: session.user.id,
    },
  });

  try {
    await enqueueProductDiscoveryScrape(query.id);
  } catch (err) {
    console.error("[createProductDiscoveryQuery] enqueue gagal", err);
    throw err;
  }

  revalidatePath("/research-hub/product-discovery");
  revalidatePath(`/research-hub/product-discovery/${query.id}`);
  return { id: query.id, status: "SCRAPING" as const };
}

export async function refreshProductDiscoveryQuery(queryId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(queryId);

  try {
    await enqueueProductDiscoveryScrape(queryId);
  } catch (err) {
    console.error("[refreshProductDiscoveryQuery] gagal", err);
    throw err;
  }

  revalidatePath("/research-hub/product-discovery");
  revalidatePath(`/research-hub/product-discovery/${queryId}`);
}

export async function deleteProductDiscoveryQuery(queryId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(queryId);

  await prisma.productDiscoveryQuery.delete({ where: { id: queryId } });
  revalidatePath("/research-hub/product-discovery");
}

export async function pollProductDiscoveryJobs(): Promise<{ polled: number }> {
  await requireMarketAnalyst();
  const polled = await pollProductDiscoveryInProgress();
  return { polled };
}

const addToCompetitorSchema = z
  .object({
    productId: z.string().min(1),
    categoryId: z.string().min(1).optional(),
    newCategoryName: z.string().min(1).max(120).optional(),
  })
  .refine((data) => data.categoryId || data.newCategoryName?.trim(), {
    message: "Pilih kategori atau buat kategori baru.",
  });

export async function addDiscoveryProductToCompetitorTracker(
  input: z.infer<typeof addToCompetitorSchema>,
) {
  await requireMarketAnalyst();
  const data = addToCompetitorSchema.parse(input);

  const product = await prisma.productDiscoveryItem.findUnique({
    where: { id: data.productId },
  });
  if (!product) throw new Error("Produk tidak ditemukan.");

  let categoryId = data.categoryId;
  if (!categoryId) {
    const created = await createCompetitorProductCategory({
      name: data.newCategoryName!.trim(),
    });
    categoryId = created.id;
  }

  const result = await addCompetitorProductTrack(
    {
      categoryId,
      productUrl: product.productUrl,
      marketplace: product.marketplace,
    },
    { background: true },
  );

  return { trackId: result.id, categoryId };
}

async function findExistingReviewSource(productUrl: string, platformKey: string) {
  return prisma.reviewIntelSource.findFirst({
    where: { productUrl, platformKey },
    orderBy: { createdAt: "desc" },
  });
}

export async function sendDiscoveryProductToReviewIntel(input: {
  productId: string;
  competitorBrand?: string;
}) {
  const session = await requireMarketAnalyst();
  const productId = z.string().min(1).parse(input.productId);

  const product = await prisma.productDiscoveryItem.findUnique({
    where: { id: productId },
    include: { query: true },
  });
  if (!product) throw new Error("Produk tidak ditemukan.");

  const platformKey = platformKeyFromMarketplace(product.marketplace);

  if (!isReviewPlatformConfigured(platformKey)) {
    throw new Error(
      `Platform review ${platformKey} belum dikonfigurasi. Cek SCRAPER_API_URL atau env Apify di server.`,
    );
  }

  const urlError = validateReviewPlatformUrl(platformKey, product.productUrl);
  if (urlError) throw new Error(urlError);

  const existing = await findExistingReviewSource(
    product.productUrl,
    platformKey,
  );
  if (existing) {
    revalidatePath("/research-hub/review-intelligence");
    revalidatePath(`/research-hub/review-intelligence/${existing.id}`);
    return { id: existing.id, existing: true as const };
  }

  const source = await prisma.reviewIntelSource.create({
    data: {
      productName: product.name,
      competitorBrand:
        input.competitorBrand?.trim() ||
        product.shopName?.trim() ||
        "Kompetitor",
      platformKey,
      marketplace: marketplaceForPlatformKey(platformKey),
      productUrl: product.productUrl,
      createdById: session.user.id,
    },
  });

  await enqueueReviewScrape(source.id);

  revalidatePath("/research-hub/review-intelligence");
  revalidatePath(`/research-hub/review-intelligence/${source.id}`);
  return { id: source.id };
}


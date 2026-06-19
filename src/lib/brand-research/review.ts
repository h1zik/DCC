import { prisma } from "@/lib/prisma";
import type { ResearchMarketplace } from "@prisma/client";

export type BrandReviewSourceRow = {
  id: string;
  productName: string;
  competitorBrand: string;
  platformKey: string;
  marketplace: ResearchMarketplace | null;
  status: string;
  reviewCount: number;
  ownerBrandId: string | null;
  createdAt: Date;
};

export async function listBrandReviewSources(userId: string): Promise<BrandReviewSourceRow[]> {
  const rows = await prisma.brandReviewSource.findMany({
    where: { createdById: userId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    productName: r.productName,
    competitorBrand: r.competitorBrand,
    platformKey: r.platformKey,
    marketplace: r.marketplace,
    status: r.status,
    reviewCount: r.reviewCount,
    ownerBrandId: r.ownerBrandId,
    createdAt: r.createdAt,
  }));
}

export async function getBrandReviewSourceDetail(sourceId: string, userId: string) {
  return prisma.brandReviewSource.findFirst({
    where: { id: sourceId, createdById: userId },
    include: {
      reviews: {
        include: { analysis: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      summary: true,
    },
  });
}

export async function createBrandReviewSource(input: {
  productName: string;
  competitorBrand: string;
  marketplace: ResearchMarketplace;
  productUrl: string;
  ownerBrandId?: string | null;
  createdById: string;
}) {
  return prisma.brandReviewSource.create({
    data: {
      productName: input.productName,
      competitorBrand: input.competitorBrand,
      marketplace: input.marketplace,
      productUrl: input.productUrl,
      ownerBrandId: input.ownerBrandId ?? null,
      createdById: input.createdById,
    },
  });
}

export async function deleteBrandReviewSource(sourceId: string, userId: string): Promise<void> {
  await prisma.brandReviewSource.deleteMany({
    where: { id: sourceId, createdById: userId },
  });
}
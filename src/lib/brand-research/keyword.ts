import { prisma } from "@/lib/prisma";
import type { ResearchMarketplace } from "@prisma/client";

export type BrandKeywordQueryRow = {
  id: string;
  category: string;
  seedKeyword: string | null;
  marketplace: ResearchMarketplace | null;
  status: string;
  ownerBrandId: string | null;
  createdAt: Date;
};

export async function listBrandKeywordQueries(userId: string): Promise<BrandKeywordQueryRow[]> {
  const rows = await prisma.brandKeywordQuery.findMany({
    where: { createdById: userId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    seedKeyword: r.seedKeyword,
    marketplace: r.marketplace,
    status: r.status,
    ownerBrandId: r.ownerBrandId,
    createdAt: r.createdAt,
  }));
}

export async function getBrandKeywordQueryDetail(queryId: string, userId: string) {
  return prisma.brandKeywordQuery.findFirst({
    where: { id: queryId, createdById: userId },
    include: { result: true },
  });
}

export async function createBrandKeywordQuery(input: {
  category: string;
  seedKeyword?: string | null;
  marketplace?: ResearchMarketplace | null;
  ownerBrandId?: string | null;
  createdById: string;
}) {
  return prisma.brandKeywordQuery.create({
    data: {
      category: input.category,
      seedKeyword: input.seedKeyword ?? null,
      marketplace: input.marketplace ?? null,
      ownerBrandId: input.ownerBrandId ?? null,
      createdById: input.createdById,
    },
  });
}

export async function deleteBrandKeywordQuery(queryId: string, userId: string): Promise<void> {
  await prisma.brandKeywordQuery.deleteMany({
    where: { id: queryId, createdById: userId },
  });
}
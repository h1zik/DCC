import { prisma } from "@/lib/prisma";
import type { BrandCompetitor, ResearchMarketplace } from "@prisma/client";

export type BrandCompetitorRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  marketplace: ResearchMarketplace;
  shopUrl: string;
  isActive: boolean;
  skuCount: number;
  ownerBrandId: string | null;
  createdAt: Date;
};

export async function listBrandCompetitors(userId: string): Promise<BrandCompetitorRow[]> {
  const rows = await prisma.brandCompetitor.findMany({
    where: { createdById: userId },
    include: { _count: { select: { skus: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    category: r.category,
    marketplace: r.marketplace,
    shopUrl: r.shopUrl,
    isActive: r.isActive,
    skuCount: r._count.skus,
    ownerBrandId: r.ownerBrandId,
    createdAt: r.createdAt,
  }));
}

export async function getBrandCompetitorDetail(competitorId: string, userId: string) {
  const competitor = await prisma.brandCompetitor.findFirst({
    where: { id: competitorId, createdById: userId },
    include: {
      skus: { orderBy: { lastSeenAt: "desc" } },
      snapshots: { orderBy: { capturedAt: "desc" }, take: 50 },
      alerts: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  return competitor;
}

export async function createBrandCompetitor(input: {
  name: string;
  brand: string;
  category: string;
  marketplace: ResearchMarketplace;
  shopUrl: string;
  ownerBrandId?: string | null;
  createdById: string;
}): Promise<BrandCompetitor> {
  return prisma.brandCompetitor.create({
    data: {
      name: input.name,
      brand: input.brand,
      category: input.category,
      marketplace: input.marketplace,
      shopUrl: input.shopUrl,
      ownerBrandId: input.ownerBrandId ?? null,
      createdById: input.createdById,
    },
  });
}

export async function deleteBrandCompetitor(competitorId: string, userId: string): Promise<void> {
  await prisma.brandCompetitor.deleteMany({
    where: { id: competitorId, createdById: userId },
  });
}
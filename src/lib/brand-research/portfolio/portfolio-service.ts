import "server-only";

import { prisma } from "@/lib/prisma";
import type {
  BrandPortfolioLineInput,
  BrandPortfolioView,
  ProductDiscoveryOption,
} from "@/lib/brand-research/portfolio/types";

export async function listProductDiscoveryOptions(): Promise<ProductDiscoveryOption[]> {
  const queries = await prisma.productDiscoveryQuery.findMany({
    where: { status: "READY" },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      id: true,
      keyword: true,
      status: true,
      productCount: true,
      marketplaces: true,
    },
  });

  return queries.map((q) => ({
    id: q.id,
    label: q.keyword,
    detail: `${q.productCount} produk · ${q.marketplaces.join(", ")}`,
    status: q.status,
  }));
}

export async function getBrandPortfolio(
  brandId: string,
): Promise<BrandPortfolioView | null> {
  const portfolio = await prisma.brandPortfolio.findUnique({
    where: { brandId },
    include: {
      brand: { select: { name: true } },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          productDiscoveryQuery: {
            select: { id: true, keyword: true, status: true },
          },
        },
      },
    },
  });

  if (!portfolio) return null;

  return {
    id: portfolio.id,
    brandId: portfolio.brandId,
    brandName: portfolio.brand.name,
    summary: portfolio.summary,
    updatedAt: portfolio.updatedAt.toISOString(),
    lines: portfolio.lines.map((line) => ({
      id: line.id,
      name: line.name,
      category: line.category,
      description: line.description,
      targetAudience: line.targetAudience,
      role: line.role,
      sortOrder: line.sortOrder,
      productDiscoveryQueryId: line.productDiscoveryQueryId,
      productDiscoveryLabel: line.productDiscoveryQuery
        ? `${line.productDiscoveryQuery.keyword} (${line.productDiscoveryQuery.status})`
        : null,
    })),
  };
}

export async function countPortfolioLines(brandId: string): Promise<number> {
  const portfolio = await prisma.brandPortfolio.findUnique({
    where: { brandId },
    select: { _count: { select: { lines: true } } },
  });
  return portfolio?._count.lines ?? 0;
}

export async function saveBrandPortfolio(
  userId: string,
  brandId: string,
  input: {
    summary?: string | null;
    lines: BrandPortfolioLineInput[];
  },
): Promise<BrandPortfolioView> {
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: true },
  });
  if (!brand) throw new Error("Brand tidak ditemukan.");

  const lines = input.lines
    .map((line, index) => ({
      ...line,
      name: line.name.trim(),
      sortOrder: line.sortOrder ?? index,
    }))
    .filter((line) => line.name.length > 0);

  if (lines.length === 0) {
    throw new Error("Tambahkan minimal satu lini produk di portfolio.");
  }

  const portfolio = await prisma.brandPortfolio.upsert({
    where: { brandId },
    create: {
      brandId,
      summary: input.summary?.trim() || null,
      createdById: userId,
      lines: {
        create: lines.map((line) => ({
          name: line.name,
          category: line.category?.trim() || null,
          description: line.description?.trim() || null,
          targetAudience: line.targetAudience?.trim() || null,
          role: line.role ?? null,
          productDiscoveryQueryId: line.productDiscoveryQueryId || null,
          sortOrder: line.sortOrder ?? 0,
        })),
      },
    },
    update: {
      summary: input.summary?.trim() || null,
      lines: {
        deleteMany: {},
        create: lines.map((line) => ({
          name: line.name,
          category: line.category?.trim() || null,
          description: line.description?.trim() || null,
          targetAudience: line.targetAudience?.trim() || null,
          role: line.role ?? null,
          productDiscoveryQueryId: line.productDiscoveryQueryId || null,
          sortOrder: line.sortOrder ?? 0,
        })),
      },
    },
    include: {
      brand: { select: { name: true } },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          productDiscoveryQuery: {
            select: { id: true, keyword: true, status: true },
          },
        },
      },
    },
  });

  return {
    id: portfolio.id,
    brandId: portfolio.brandId,
    brandName: portfolio.brand.name,
    summary: portfolio.summary,
    updatedAt: portfolio.updatedAt.toISOString(),
    lines: portfolio.lines.map((line) => ({
      id: line.id,
      name: line.name,
      category: line.category,
      description: line.description,
      targetAudience: line.targetAudience,
      role: line.role,
      sortOrder: line.sortOrder,
      productDiscoveryQueryId: line.productDiscoveryQueryId,
      productDiscoveryLabel: line.productDiscoveryQuery
        ? `${line.productDiscoveryQuery.keyword} (${line.productDiscoveryQuery.status})`
        : null,
    })),
  };
}

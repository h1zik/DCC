import { prisma } from "@/lib/prisma";

export type BrandTrendDigestRow = {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  status: string;
  isGlobal: boolean;
  ownerBrandId: string | null;
  signalCount: number;
  createdAt: Date;
};

export async function listBrandTrendDigests(userId: string): Promise<BrandTrendDigestRow[]> {
  const rows = await prisma.brandTrendDigest.findMany({
    where: { OR: [{ isGlobal: true }, { ownerBrandId: { not: null } }] },
    include: { _count: { select: { items: true } } },
    orderBy: { weekStart: "desc" },
    take: 30,
  });
  return rows.map((r) => ({
    id: r.id,
    weekStart: r.weekStart,
    weekEnd: r.weekEnd,
    status: r.status,
    isGlobal: r.isGlobal,
    ownerBrandId: r.ownerBrandId,
    signalCount: r._count.items,
    createdAt: r.createdAt,
  }));
}

export async function getBrandTrendDigestDetail(digestId: string) {
  return prisma.brandTrendDigest.findFirst({
    where: { id: digestId },
    include: { items: { orderBy: { createdAt: "desc" } } },
  });
}
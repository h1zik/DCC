import { prisma } from "@/lib/prisma";
import type { SocialListeningPlatform } from "@prisma/client";

export type BrandSocialMonitorRow = {
  id: string;
  name: string;
  keywords: string[];
  platforms: SocialListeningPlatform[];
  isActive: boolean;
  ownerBrandId: string | null;
  createdAt: Date;
};

export async function listBrandSocialMonitors(userId: string): Promise<BrandSocialMonitorRow[]> {
  const rows = await prisma.brandSocialMonitor.findMany({
    where: { createdById: userId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    keywords: r.keywords,
    platforms: r.platforms,
    isActive: r.isActive,
    ownerBrandId: r.ownerBrandId,
    createdAt: r.createdAt,
  }));
}

export async function getBrandSocialMonitorDetail(monitorId: string, userId: string) {
  return prisma.brandSocialMonitor.findFirst({
    where: { id: monitorId, createdById: userId },
    include: {
      batches: {
        include: { summary: true, _count: { select: { mentions: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
}

export async function createBrandSocialMonitor(input: {
  name: string;
  keywords: string[];
  platforms: SocialListeningPlatform[];
  ownerBrandId?: string | null;
  createdById: string;
}) {
  return prisma.brandSocialMonitor.create({
    data: {
      name: input.name,
      keywords: input.keywords,
      platforms: input.platforms,
      ownerBrandId: input.ownerBrandId ?? null,
      createdById: input.createdById,
    },
  });
}

export async function deleteBrandSocialMonitor(monitorId: string, userId: string): Promise<void> {
  await prisma.brandSocialMonitor.deleteMany({
    where: { id: monitorId, createdById: userId },
  });
}
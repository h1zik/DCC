import { prisma } from "@/lib/prisma";

export type BrandUspAnalysisRow = {
  id: string;
  category: string;
  status: string;
  ownerBrandId: string | null;
  createdAt: Date;
};

export async function listBrandUspAnalyses(userId: string): Promise<BrandUspAnalysisRow[]> {
  const rows = await prisma.brandUspAnalysis.findMany({
    where: { createdById: userId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    status: r.status,
    ownerBrandId: r.ownerBrandId,
    createdAt: r.createdAt,
  }));
}

export async function getBrandUspAnalysisDetail(analysisId: string, userId: string) {
  return prisma.brandUspAnalysis.findFirst({
    where: { id: analysisId, createdById: userId },
    include: { result: true },
  });
}

export async function createBrandUspAnalysis(input: {
  category: string;
  ownerBrandId?: string | null;
  createdById: string;
}) {
  return prisma.brandUspAnalysis.create({
    data: {
      category: input.category,
      ownerBrandId: input.ownerBrandId ?? null,
      createdById: input.createdById,
    },
  });
}

export async function deleteBrandUspAnalysis(analysisId: string, userId: string): Promise<void> {
  await prisma.brandUspAnalysis.deleteMany({
    where: { id: analysisId, createdById: userId },
  });
}
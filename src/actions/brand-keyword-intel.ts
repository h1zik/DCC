"use server";

import { revalidatePath } from "next/cache";
import { ResearchMarketplace } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import { enqueueBrandKeywordAnalysis } from "@/lib/brand-research/keyword-analyzer";

const createQuerySchema = z.object({
  category: z.string().min(1).max(200),
  seedKeyword: z.string().max(200).optional(),
  marketplace: z.nativeEnum(ResearchMarketplace).optional(),
});

export async function createBrandKeywordIntelQuery(
  input: z.infer<typeof createQuerySchema>,
) {
  const session = await requireBrandManager();
  const data = createQuerySchema.parse(input);

  const query = await prisma.brandKeywordQuery.create({
    data: {
      category: data.category,
      seedKeyword: data.seedKeyword?.trim() || null,
      marketplace: data.marketplace ?? null,
      createdById: session.user.id,
    },
  });

  try {
    await enqueueBrandKeywordAnalysis(query.id);
  } catch (err) {
    console.error("[createBrandKeywordIntelQuery] analisis gagal", err);
    throw err;
  }

  revalidatePath("/brand-hub/keyword-intel");
  revalidatePath(`/brand-hub/keyword-intel/${query.id}`);
  return { id: query.id };
}

export async function refreshBrandKeywordIntelQuery(queryId: string) {
  await requireBrandManager();
  z.string().min(1).parse(queryId);

  await prisma.brandKeywordResult.deleteMany({ where: { queryId } });

  try {
    await enqueueBrandKeywordAnalysis(queryId);
  } catch (err) {
    console.error("[refreshBrandKeywordIntelQuery] gagal", err);
    throw err;
  }

  revalidatePath("/brand-hub/keyword-intel");
  revalidatePath(`/brand-hub/keyword-intel/${queryId}`);
}

export async function deleteBrandKeywordIntelQuery(queryId: string) {
  await requireBrandManager();
  z.string().min(1).parse(queryId);

  await prisma.brandKeywordQuery.delete({ where: { id: queryId } });

  revalidatePath("/brand-hub/keyword-intel");
}

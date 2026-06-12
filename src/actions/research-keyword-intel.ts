"use server";

import { revalidatePath } from "next/cache";
import { ResearchMarketplace } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import { enqueueKeywordAnalysis } from "@/lib/research/keyword-intel/keyword-analyzer";

const createQuerySchema = z.object({
  category: z.string().min(1).max(200),
  seedKeyword: z.string().max(200).optional(),
  marketplace: z.nativeEnum(ResearchMarketplace).optional(),
});

export async function createKeywordIntelQuery(
  input: z.infer<typeof createQuerySchema>,
) {
  const session = await requireMarketAnalyst();
  const data = createQuerySchema.parse(input);

  const query = await prisma.keywordIntelQuery.create({
    data: {
      category: data.category,
      seedKeyword: data.seedKeyword?.trim() || null,
      marketplace: data.marketplace ?? null,
      createdById: session.user.id,
    },
  });

  try {
    await enqueueKeywordAnalysis(query.id);
  } catch (err) {
    console.error("[createKeywordIntelQuery] analisis gagal", err);
    throw err;
  }

  revalidatePath("/research-hub/keyword-intel");
  revalidatePath(`/research-hub/keyword-intel/${query.id}`);
  return { id: query.id };
}

export async function refreshKeywordIntelQuery(queryId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(queryId);

  await prisma.keywordIntelResult.deleteMany({ where: { queryId } });

  try {
    await enqueueKeywordAnalysis(queryId);
  } catch (err) {
    console.error("[refreshKeywordIntelQuery] gagal", err);
    throw err;
  }

  revalidatePath("/research-hub/keyword-intel");
  revalidatePath(`/research-hub/keyword-intel/${queryId}`);
}

export async function deleteKeywordIntelQuery(queryId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(queryId);

  await prisma.keywordIntelQuery.delete({ where: { id: queryId } });

  revalidatePath("/research-hub/keyword-intel");
}

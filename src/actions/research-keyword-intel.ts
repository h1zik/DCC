"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { ResearchMarketplace } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import { enqueueKeywordAnalysis } from "@/lib/research/keyword-intel/keyword-analyzer";
import {
  getDefaultKeywordSourceConfig,
  validateKeywordSourceConfig,
} from "@/lib/research/keyword-intel/keyword-source-config";

const createQuerySchema = z.object({
  category: z.string().min(1).max(200),
  seedKeyword: z.string().max(200).optional(),
  marketplace: z.nativeEnum(ResearchMarketplace).optional(),
  sourceConfig: z.unknown().optional(),
});

export async function createKeywordIntelQuery(
  input: z.infer<typeof createQuerySchema>,
) {
  const session = await requireMarketAnalyst();
  const data = createQuerySchema.parse(input);
  const sourceConfig = data.sourceConfig
    ? validateKeywordSourceConfig(data.sourceConfig)
    : getDefaultKeywordSourceConfig();

  const query = await prisma.keywordIntelQuery.create({
    data: {
      category: data.category,
      seedKeyword: data.seedKeyword?.trim() || null,
      marketplace: data.marketplace ?? null,
      sourceConfig: sourceConfig as object,
      createdById: session.user.id,
    },
  });

  after(async () => {
    try {
      await enqueueKeywordAnalysis(query.id);
    } catch (err) {
      console.error("[createKeywordIntelQuery] analisis gagal", err);
    }
  });

  revalidatePath("/research-hub/keyword-intel");
  revalidatePath(`/research-hub/keyword-intel/${query.id}`);
  return { id: query.id };
}

export async function refreshKeywordIntelQuery(queryId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(queryId);

  const existing = await prisma.keywordIntelQuery.findUnique({
    where: { id: queryId },
  });
  if (!existing) throw new Error("Query tidak ditemukan.");

  await prisma.keywordIntelQuery.update({
    where: { id: queryId },
    data: {
      status: "PENDING",
      digestMode: "LIVE",
      dataNotice: null,
      errorMessage: null,
    },
  });

  after(async () => {
    try {
      await enqueueKeywordAnalysis(queryId);
    } catch (err) {
      console.error("[refreshKeywordIntelQuery] gagal", err);
    }
  });

  revalidatePath("/research-hub/keyword-intel");
  revalidatePath(`/research-hub/keyword-intel/${queryId}`);
}

export async function deleteKeywordIntelQuery(queryId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(queryId);

  await prisma.keywordIntelQuery.delete({ where: { id: queryId } });

  revalidatePath("/research-hub/keyword-intel");
}

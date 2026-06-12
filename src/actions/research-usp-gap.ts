"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMarketAnalyst } from "@/lib/research/auth";
import { analyzeUspGap } from "@/lib/research/usp-gap/usp-analyzer";

const contextModulesSchema = z.object({
  reviewIntel: z.boolean().optional(),
  competitor: z.boolean().optional(),
  trendRadar: z.boolean().optional(),
  keywordIntel: z.boolean().optional(),
  socialListening: z.boolean().optional(),
});

const analysisSchema = z.object({
  category: z.string().min(1).max(120),
  brandId: z.string().optional(),
  contextModules: contextModulesSchema,
});

export async function createUspGapAnalysis(
  input: z.infer<typeof analysisSchema>,
) {
  const session = await requireMarketAnalyst();
  const data = analysisSchema.parse(input);

  const analysis = await prisma.uspGapAnalysis.create({
    data: {
      category: data.category.trim(),
      brandId: data.brandId ?? null,
      contextModules: data.contextModules,
      createdById: session.user.id,
    },
  });

  try {
    await analyzeUspGap(analysis.id);
  } catch (err) {
    console.error("[createUspGapAnalysis] analisis gagal", err);
    throw err;
  }

  revalidatePath("/research-hub/usp-analyzer");
  return { id: analysis.id };
}

export async function refreshUspGapAnalysis(analysisId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(analysisId);

  try {
    await analyzeUspGap(analysisId);
  } catch (err) {
    console.error("[refreshUspGapAnalysis] gagal", err);
    throw err;
  }

  revalidatePath("/research-hub/usp-analyzer");
  revalidatePath(`/research-hub/usp-analyzer/${analysisId}`);
}

export async function deleteUspGapAnalysis(analysisId: string) {
  await requireMarketAnalyst();
  z.string().min(1).parse(analysisId);

  await prisma.uspGapAnalysis.delete({ where: { id: analysisId } });
  revalidatePath("/research-hub/usp-analyzer");
}

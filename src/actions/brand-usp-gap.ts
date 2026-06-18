"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import {
  listBrandUspContextSourceOptions,
  suggestBrandContextSourceIds,
} from "@/lib/brand-research/list-context-sources";
import { analyzeBrandUspGap } from "@/lib/brand-research/usp-analyzer";

const contextModulesSchema = z.object({
  reviewIntel: z.boolean().optional(),
  competitor: z.boolean().optional(),
  trendRadar: z.boolean().optional(),
  keywordIntel: z.boolean().optional(),
  socialListening: z.boolean().optional(),
  reviewSourceIds: z.array(z.string()).optional(),
  competitorIds: z.array(z.string()).optional(),
  trendDigestId: z.string().optional(),
  keywordQueryId: z.string().optional(),
  socialMonitorId: z.string().optional(),
});

const analysisSchema = z.object({
  category: z.string().min(1).max(120),
  ownerBrandId: z.string().optional(),
  contextModules: contextModulesSchema,
});

export async function getBrandUspContextSourceOptions() {
  await requireBrandManager();
  return listBrandUspContextSourceOptions();
}

export async function suggestBrandUspContextSources(category: string) {
  await requireBrandManager();
  return suggestBrandContextSourceIds(category);
}

export async function createBrandUspGapAnalysis(
  input: z.infer<typeof analysisSchema>,
) {
  const session = await requireBrandManager();
  const data = analysisSchema.parse(input);

  const analysis = await prisma.brandUspAnalysis.create({
    data: {
      category: data.category.trim(),
      ownerBrandId: data.ownerBrandId ?? null,
      contextModules: data.contextModules,
      createdById: session.user.id,
    },
  });

  // Non-blocking: kembalikan segera, jalankan analisis di background.
  // UI memantau via status (GATHERING -> ANALYZING -> READY).
  after(async () => {
    try {
      await analyzeBrandUspGap(analysis.id);
    } catch (err) {
      console.error("[createBrandUspGapAnalysis] analisis gagal", err);
    }
  });

  revalidatePath("/brand-hub/usp-analyzer");
  return { id: analysis.id };
}

export async function refreshBrandUspGapAnalysis(analysisId: string) {
  await requireBrandManager();
  z.string().min(1).parse(analysisId);

  await prisma.brandUspAnalysis.update({
    where: { id: analysisId },
    data: { status: "GATHERING", errorMessage: null },
  });

  after(async () => {
    try {
      await analyzeBrandUspGap(analysisId);
    } catch (err) {
      console.error("[refreshBrandUspGapAnalysis] gagal", err);
    }
  });

  revalidatePath("/brand-hub/usp-analyzer");
  revalidatePath(`/brand-hub/usp-analyzer/${analysisId}`);
}

export async function deleteBrandUspGapAnalysis(analysisId: string) {
  await requireBrandManager();
  z.string().min(1).parse(analysisId);

  await prisma.brandUspAnalysis.delete({ where: { id: analysisId } });
  revalidatePath("/brand-hub/usp-analyzer");
}

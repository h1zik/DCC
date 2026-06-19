"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireBrandManager } from "@/lib/brand-research/auth";
import {
  assessCreativeGuidelineReadiness,
} from "@/lib/brand-research/strategy/evidence-gate";
import {
  generateBrandCreativeGuideline,
  getBrandCreativeGuideline,
  listBrandCreativeGuidelines,
} from "@/lib/brand-research/creative/guideline-generator";
import { buildCreativeGuidelinePdfHtml } from "@/lib/brand-research/creative/guideline-pdf-html";
import { listBrandVisualAssets } from "@/lib/brand-research/visual";

const createSchema = z.object({
  ownerBrandId: z.string().optional().nullable(),
  strategyDocumentId: z.string().optional().nullable(),
});

export async function createBrandCreativeGuideline(
  input: z.infer<typeof createSchema>,
) {
  const session = await requireBrandManager();
  const data = createSchema.parse(input);

  const readiness = await assessCreativeGuidelineReadiness(
    session.user.id,
    data.ownerBrandId ?? null,
    data.strategyDocumentId ?? null,
  );
  if (!readiness.canGenerate) {
    throw new Error(readiness.message ?? "Syarat creative guideline belum terpenuhi.");
  }

  const guideline = await prisma.brandCreativeGuideline.create({
    data: {
      ownerBrandId: data.ownerBrandId ?? null,
      strategyDocumentId: data.strategyDocumentId ?? null,
      createdById: session.user.id,
    },
  });

  after(async () => {
    try {
      await generateBrandCreativeGuideline(guideline.id, session.user.id);
    } catch (err) {
      console.error("[createBrandCreativeGuideline]", err);
    }
  });

  revalidatePath("/brand-hub/creative-guideline");
  return { id: guideline.id };
}

export async function regenerateBrandCreativeGuideline(guidelineId: string) {
  const session = await requireBrandManager();
  z.string().min(1).parse(guidelineId);

  const existing = await prisma.brandCreativeGuideline.findFirst({
    where: { id: guidelineId, createdById: session.user.id },
    select: { ownerBrandId: true, strategyDocumentId: true },
  });
  if (!existing) throw new Error("Creative guideline tidak ditemukan.");

  const readiness = await assessCreativeGuidelineReadiness(
    session.user.id,
    existing.ownerBrandId,
    existing.strategyDocumentId,
  );
  if (!readiness.canGenerate) {
    throw new Error(readiness.message ?? "Syarat creative guideline belum terpenuhi.");
  }

  after(async () => {
    try {
      await generateBrandCreativeGuideline(guidelineId, session.user.id);
    } catch (err) {
      console.error("[regenerateBrandCreativeGuideline]", err);
    }
  });

  revalidatePath("/brand-hub/creative-guideline");
}

export async function deleteBrandCreativeGuideline(guidelineId: string) {
  const session = await requireBrandManager();
  await prisma.brandCreativeGuideline.deleteMany({
    where: { id: guidelineId, createdById: session.user.id },
  });
  revalidatePath("/brand-hub/creative-guideline");
}

export async function getBrandCreativeGuidelinePageData(ownerBrandId?: string | null) {
  const session = await requireBrandManager();
  const guidelines = await listBrandCreativeGuidelines(
    session.user.id,
    ownerBrandId,
  );

  const strategyDocs = await prisma.brandStrategyDocument.findMany({
    where: {
      createdById: session.user.id,
      status: "READY",
      ...(ownerBrandId ? { ownerBrandId } : {}),
    },
    select: { id: true, brandEssence: true },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  const visualAssets = await listBrandVisualAssets(session.user.id, ownerBrandId);
  const defaultStrategyId = strategyDocs[0]?.id ?? null;
  const guidelineReadiness = await assessCreativeGuidelineReadiness(
    session.user.id,
    ownerBrandId ?? null,
    defaultStrategyId,
  );

  return {
    guidelines: guidelines.map((g) => ({
      id: g.id,
      status: g.status,
      ownerBrandId: g.ownerBrandId,
      strategyDocumentId: g.strategyDocumentId,
      strategyEssence: g.strategyDocument?.brandEssence ?? null,
      moodboardAssetIds: g.moodboardAssetIds,
      colorPalette: g.colorPalette,
      typography: g.typography,
      designReferences: g.designReferences,
      aiSummary: g.aiSummary,
      errorMessage: g.errorMessage,
      updatedAt: g.updatedAt.toISOString(),
    })),
    strategyOptions: strategyDocs,
    guidelineReadiness,
    visualAssetCount: visualAssets.length,
  };
}

export async function getBrandCreativeGuidelineDetail(guidelineId: string) {
  const session = await requireBrandManager();
  const guideline = await getBrandCreativeGuideline(guidelineId, session.user.id);
  if (!guideline) throw new Error("Guideline tidak ditemukan.");

  const moodboardIds = Array.isArray(guideline.moodboardAssetIds)
    ? (guideline.moodboardAssetIds as string[])
    : [];

  const assets = await listBrandVisualAssets(
    session.user.id,
    guideline.ownerBrandId,
  );
  const moodboardAssets = assets.filter((a) => moodboardIds.includes(a.id));

  return {
    guideline: {
      id: guideline.id,
      status: guideline.status,
      moodboardAssetIds: moodboardIds,
      colorPalette: guideline.colorPalette,
      typography: guideline.typography,
      designReferences: guideline.designReferences,
      aiSummary: guideline.aiSummary,
      strategy: guideline.strategyDocument,
    },
    moodboardAssets: moodboardAssets.map((a) => ({
      id: a.id,
      imageUrl: a.imageUrl,
      title: a.title,
      source: a.source,
    })),
  };
}

export async function exportBrandCreativeGuidelinePdfHtml(guidelineId: string) {
  const session = await requireBrandManager();
  const detail = await getBrandCreativeGuidelineDetail(guidelineId);
  return buildCreativeGuidelinePdfHtml(detail);
}

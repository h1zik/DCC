import "server-only";

import { BrandCreativeGuidelineStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import { listBrandVisualAssets } from "@/lib/brand-research/visual";

type GuidelineResult = {
  moodboardAssetIds: string[];
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    neutrals: string[];
    rationale: string;
  };
  typography: {
    heading: string;
    body: string;
    accent: string;
    stylingNotes: string;
  };
  designReferences: {
    category: string;
    assetIds: string[];
    narrative: string;
  }[];
  aiSummary: string;
};

export async function generateBrandCreativeGuideline(
  guidelineId: string,
  userId: string,
): Promise<void> {
  const guideline = await prisma.brandCreativeGuideline.findFirst({
    where: { id: guidelineId, createdById: userId },
    include: { strategyDocument: true },
  });
  if (!guideline) throw new Error("Creative guideline tidak ditemukan.");

  await prisma.brandCreativeGuideline.update({
    where: { id: guidelineId },
    data: { status: BrandCreativeGuidelineStatus.GENERATING, errorMessage: null },
  });

  try {
    const strategy = guideline.strategyDocument;
    const assets = await listBrandVisualAssets(userId, guideline.ownerBrandId);
    const assetPool = assets.slice(0, 60).map((a) => ({
      id: a.id,
      source: a.source,
      title: a.title,
      imageUrl: a.imageUrl,
      tags: a.tags,
      dominantColors: a.dominantColors,
    }));

    const prompt = `Kamu adalah Creative Director beauty brand Indonesia.

Susun CREATIVE GUIDELINE berdasarkan Brand Strategy dan visual references.

Brand Strategy:
${JSON.stringify(
  {
    brandPurpose: strategy?.brandPurpose,
    brandEssence: strategy?.brandEssence,
    coreMessage: strategy?.coreMessage,
    brandUsp: strategy?.brandUsp,
    stp: strategy?.stp,
    brandPersonality: strategy?.brandPersonality,
    toneOfVoice: strategy?.toneOfVoice,
  },
  null,
  2,
)}

Visual asset pool (pilih moodboardAssetIds HANYA dari id yang ada di daftar):
${JSON.stringify(assetPool, null, 2)}

Tugas:
1. moodboardAssetIds: pilih 12-20 id terbaik untuk moodboard (urutan grid)
2. colorPalette: hex colors + rationale selaras personality & visual refs
3. typography: rekomendasi font pairing (Google Fonts style names) + stylingNotes
4. designReferences: 3-5 grup (packaging, social, editorial, competitor contrast) dengan assetIds + narrative
5. aiSummary: 2-3 kalimat arahan creative untuk tim desain

Balas HANYA JSON:
{
  "moodboardAssetIds": ["id"],
  "colorPalette": { "primary": "#hex", "secondary": "#hex", "accent": "#hex", "neutrals": ["#hex"], "rationale": "string" },
  "typography": { "heading": "string", "body": "string", "accent": "string", "stylingNotes": "string" },
  "designReferences": [{ "category": "string", "assetIds": ["id"], "narrative": "string" }],
  "aiSummary": "string"
}`;

    const result = await generateResearchJson<GuidelineResult>(prompt, { tier: "pro" });
    const aiMeta = researchAiMetaFromSteps([
      buildResearchAiStep("Creative guideline synthesis", "pro"),
    ]);

    const validIds = new Set(assetPool.map((a) => a.id));
    const moodboardIds = (result.moodboardAssetIds ?? []).filter((id) =>
      validIds.has(id),
    );

    await prisma.brandCreativeGuideline.update({
      where: { id: guidelineId },
      data: {
        status: BrandCreativeGuidelineStatus.READY,
        moodboardAssetIds: moodboardIds as object,
        colorPalette: result.colorPalette as object,
        typography: result.typography as object,
        designReferences: (result.designReferences ?? []) as object,
        aiSummary: result.aiSummary,
        aiMeta: aiMeta as object,
        errorMessage: null,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Generasi creative guideline gagal.";
    await prisma.brandCreativeGuideline.update({
      where: { id: guidelineId },
      data: {
        status: BrandCreativeGuidelineStatus.FAILED,
        errorMessage: message,
      },
    });
    throw err;
  }
}

export async function listBrandCreativeGuidelines(
  userId: string,
  ownerBrandId?: string | null,
) {
  return prisma.brandCreativeGuideline.findMany({
    where: {
      createdById: userId,
      ...(ownerBrandId ? { ownerBrandId } : {}),
    },
    include: { strategyDocument: { select: { id: true, brandEssence: true } } },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
}

export async function getBrandCreativeGuideline(guidelineId: string, userId: string) {
  return prisma.brandCreativeGuideline.findFirst({
    where: { id: guidelineId, createdById: userId },
    include: { strategyDocument: true },
  });
}

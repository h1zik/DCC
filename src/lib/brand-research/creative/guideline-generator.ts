import "server-only";

import { BrandCreativeGuidelineStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import {
  computeDominantPaletteFromAssets,
  listBrandVisualAssets,
} from "@/lib/brand-research/visual";
import { brandStudioBrandFilter } from "@/lib/brand-research/brand-studio-scope";

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

function mergePaletteWithBaseline(
  ai: GuidelineResult["colorPalette"],
  baseline: ReturnType<typeof computeDominantPaletteFromAssets>,
): GuidelineResult["colorPalette"] {
  if (!baseline) return ai;
  return {
    primary: baseline.primary,
    secondary: baseline.secondary,
    accent: baseline.accent,
    neutrals: baseline.neutrals,
    rationale: ai.rationale,
  };
}

export async function generateBrandCreativeGuideline(
  guidelineId: string,
  userId: string,
): Promise<void> {
  const guideline = await prisma.brandCreativeGuideline.findFirst({
    where: { id: guidelineId },
    include: { strategyDocument: true },
  });
  if (!guideline) throw new Error("Creative guideline tidak ditemukan.");

  if (!guideline.strategyDocument || guideline.strategyDocument.status !== "READY") {
    throw new Error("Brand Strategy belum READY — pilih dokumen strategi yang siap.");
  }

  await prisma.brandCreativeGuideline.update({
    where: { id: guidelineId },
    data: { status: BrandCreativeGuidelineStatus.GENERATING, errorMessage: null },
  });

  try {
    const strategy = guideline.strategyDocument;
    const assets = await listBrandVisualAssets(userId, guideline.ownerBrandId);
    if (assets.length < 5) {
      throw new Error(
        `Visual Library butuh minimal 5 asset (saat ini ${assets.length}).`,
      );
    }

    const baselinePalette = computeDominantPaletteFromAssets(assets);
    const assetPool = assets.slice(0, 60).map((a) => ({
      id: a.id,
      source: a.source,
      title: a.title,
      imageUrl: a.imageUrl,
      tags: a.tags,
      dominantColors: a.dominantColors,
    }));

    const baselineSection = baselinePalette
      ? `
PALETTE BASELINE (WAJIB — hex dari agregasi ${baselinePalette.sampleCount} sampel warna visual library, JANGAN ubah hex):
${JSON.stringify(
  {
    primary: baselinePalette.primary,
    secondary: baselinePalette.secondary,
    accent: baselinePalette.accent,
    neutrals: baselinePalette.neutrals,
  },
  null,
  2,
)}
Tulis rationale yang menjelaskan mengapa palette baseline cocok dengan brand personality & visual refs.`
      : "";

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
${baselineSection}

Tugas:
1. moodboardAssetIds: pilih 12-20 id terbaik untuk moodboard (urutan grid)
2. colorPalette: gunakan hex baseline di atas jika ada; tulis rationale saja
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

    const colorPalette = mergePaletteWithBaseline(
      result.colorPalette,
      baselinePalette,
    );

    await prisma.brandCreativeGuideline.update({
      where: { id: guidelineId },
      data: {
        status: BrandCreativeGuidelineStatus.READY,
        moodboardAssetIds: moodboardIds as object,
        colorPalette: colorPalette as object,
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
  _userId: string,
  ownerBrandId?: string | null,
) {
  return prisma.brandCreativeGuideline.findMany({
    where: brandStudioBrandFilter(ownerBrandId),
    include: { strategyDocument: { select: { id: true, brandEssence: true, status: true } } },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
}

export async function getBrandCreativeGuideline(guidelineId: string, _userId: string) {
  return prisma.brandCreativeGuideline.findFirst({
    where: { id: guidelineId },
    include: { strategyDocument: true },
  });
}

import "server-only";

import { BrandStrategyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import {
  buildBrandStrategyPrompt,
  buildBrandStrategySectionPrompt,
} from "@/lib/brand-research/strategy/prompts/brand-strategy";
import { buildBrandStrategyInsightPrompt } from "@/lib/brand-research/strategy/prompts/brand-strategy-insights";
import { assessBrandEvidenceReadiness } from "@/lib/brand-research/strategy/evidence-gate";
import type {
  EvidenceSnapshot,
  InsightMemo,
  StrategyFieldRationale,
  StrategyGenerationConfig,
  StrategySectionField,
} from "@/lib/brand-research/strategy/evidence-types";
import {
  defaultStrategyGenerationConfig,
  getStrategySourceCatalog,
} from "@/lib/brand-research/strategy/strategy-source-catalog";
import { filterBrandVisualAssetsForStrategy } from "@/lib/brand-research/strategy/strategy-visual-filter";
import {
  loadVisualImageParts,
  sampleVisualAssetsForVision,
} from "@/lib/brand-research/strategy/visual-vision";
import { listBrandVisualAssets } from "@/lib/brand-research/visual";
import { brandStudioBrandFilter } from "@/lib/brand-research/brand-studio-scope";
import { resolveResearchProvider } from "@/lib/research/llm/config";
import { gatherStrategyEvidence } from "@/lib/brand-research/strategy/strategy-evidence-gather";
import {
  buildCitationRepairPrompt,
  validateStrategyCitations,
} from "@/lib/brand-research/strategy/strategy-citation-validator";
import { gatherMarketBrandNames } from "@/lib/research/brand-guard";
import { coerceActionPlan } from "@/lib/research/prescriptive/parse";
import type { ActionPlan } from "@/lib/research/prescriptive/types";

export { gatherStrategyEvidence } from "@/lib/brand-research/strategy/strategy-evidence-gather";

type StrategyResult = {
  brandPurpose: string;
  brandEssence: string;
  coreMessage: string;
  brandUsp: string;
  stp: { segment: string; targeting: string; positioningStatement: string };
  brandPersonality: {
    archetype: string;
    traits: string[];
    antiTraits: string[];
  };
  toneOfVoice: {
    principles: string[];
    doExamples: string[];
    dontExamples: string[];
  };
  productLineStrategy?: {
    lineId?: string;
    lineName: string;
    role?: string;
    category?: string;
    positioning: string;
    keyMessage: string;
    differentiator: string;
    targetAudience?: string;
    portfolioFit?: string;
  }[];
  strategicTensions?: InsightMemo["strategicTensions"];
  strategyRationales?: StrategyFieldRationale[];
  evidenceRefs: unknown[];
  actionPlan?: unknown;
  aiSummary: string;
};

type SectionRegenResult = {
  field: string;
  value: unknown;
  rationale: StrategyFieldRationale;
};

async function loadVisionParts(
  userId: string,
  ownerBrandId: string | null,
  config: StrategyGenerationConfig,
) {
  const visualAssets = config.visual.enabled
    ? filterBrandVisualAssetsForStrategy(
        await listBrandVisualAssets(userId, ownerBrandId),
        config.visual,
      )
    : [];

  let imageParts: { mimeType: string; data: string; label?: string }[] = [];
  const useVision =
    config.visual.enabled &&
    config.visual.analyzeImages &&
    resolveResearchProvider() === "gemini" &&
    visualAssets.length > 0;

  if (useVision) {
    const sampled = sampleVisualAssetsForVision(
      visualAssets.map((a) => ({
        id: a.id,
        imageUrl: a.imageUrl,
        thumbnailUrl: a.thumbnailUrl,
        title: a.title,
        tags: a.tags,
        collectionId: a.collectionId,
      })),
      Math.min(config.visual.maxSamples ?? 12, 16),
    );
    const loaded = await loadVisualImageParts(sampled);
    imageParts = loaded.parts;
    return {
      visualAssets,
      imageParts,
      visualImageAnalysis: {
        enabled: true,
        sampleCount: sampled.length,
        loadedCount: loaded.loadedCount,
        sampleLabels: loaded.parts.map((p) => p.label ?? "visual"),
      },
    };
  }

  return {
    visualAssets,
    imageParts: [] as { mimeType: string; data: string; label?: string }[],
    visualImageAnalysis:
      config.visual.enabled && visualAssets.length > 0
        ? {
            enabled: false,
            sampleCount: 0,
            loadedCount: 0,
            sampleLabels: [] as string[],
          }
        : undefined,
  };
}

function mergeRationales(
  existing: StrategyFieldRationale[],
  updated: StrategyFieldRationale[],
): StrategyFieldRationale[] {
  const byField = new Map(existing.map((r) => [r.field, r]));
  for (const r of updated) {
    byField.set(r.field, r);
  }
  return [...byField.values()];
}

function documentFieldsForSection(doc: {
  brandPurpose: string | null;
  brandEssence: string | null;
  coreMessage: string | null;
  brandUsp: string | null;
  stp: unknown;
  brandPersonality: unknown;
  toneOfVoice: unknown;
}): Record<string, unknown> {
  return {
    brandPurpose: doc.brandPurpose,
    brandEssence: doc.brandEssence,
    coreMessage: doc.coreMessage,
    brandUsp: doc.brandUsp,
    stp: doc.stp,
    brandPersonality: doc.brandPersonality,
    toneOfVoice: doc.toneOfVoice,
  };
}

export async function generateBrandStrategyDocument(
  documentId: string,
  userId: string,
  generationConfig?: StrategyGenerationConfig,
): Promise<void> {
  const doc = await prisma.brandStrategyDocument.findFirst({
    where: { id: documentId },
  });
  if (!doc) throw new Error("Dokumen strategi tidak ditemukan.");

  const catalog = await getStrategySourceCatalog(userId, doc.ownerBrandId);
  const config =
    generationConfig ?? defaultStrategyGenerationConfig(catalog);

  await prisma.brandStrategyDocument.update({
    where: { id: documentId },
    data: {
      status: BrandStrategyStatus.GENERATING,
      errorMessage: null,
      generationConfig: config as object,
    },
  });

  try {
    const readiness = await assessBrandEvidenceReadiness(userId, doc.ownerBrandId);
    const evidence = await gatherStrategyEvidence(
      userId,
      doc.ownerBrandId,
      config,
      catalog.visual,
      {
        category: doc.category ?? undefined,
        pmBrief: doc.pmBrief ?? undefined,
        demoFlags: readiness.demoFlags,
      },
    );

    const { imageParts, visualImageAnalysis } = await loadVisionParts(
      userId,
      doc.ownerBrandId,
      config,
    );
    if (visualImageAnalysis) {
      evidence.visualImageAnalysis = visualImageAnalysis;
    }

    const snapshot: EvidenceSnapshot = {
      gatheredAt: new Date().toISOString(),
      ownerBrandId: doc.ownerBrandId,
      readiness,
      sourceRefs: evidence.sourceRefs,
      input: {
        generationConfig: config,
        category: evidence.category,
        pmBrief: evidence.pmBrief,
        brandName: evidence.brandName,
        reviewInsights: evidence.reviewInsights,
        socialInsights: evidence.socialInsights,
        representativeQuotes: evidence.representativeQuotes,
        visualTags: evidence.visualTags,
        visualTrendTags: evidence.visualTrendTags,
        dominantPalette: evidence.dominantPalette,
        visualAssetCount: evidence.visualAssetCount,
        visualImageAnalysis: evidence.visualImageAnalysis,
        competitorSignals: evidence.competitorSignals,
        keywordThemes: evidence.keywordThemes,
        trendSignals: evidence.trendSignals,
        uspInsights: evidence.uspInsights,
        portfolioSummary: evidence.portfolioSummary,
        portfolioLines: evidence.portfolioLines,
        productDiscoveryInsights: evidence.productDiscoveryInsights,
        competitorProductInsights: evidence.competitorProductInsights,
      },
    };

    const forbiddenBrands = await gatherMarketBrandNames({
      category: doc.category ?? undefined,
    });

    const insightMemo = await generateResearchJson<InsightMemo>(
      buildBrandStrategyInsightPrompt(evidence),
      { tier: "pro" },
    );

    const strategyPrompt = buildBrandStrategyPrompt(
      evidence,
      insightMemo,
      forbiddenBrands,
    );
    let result = await generateResearchJson<StrategyResult>(strategyPrompt, {
      tier: "pro",
      imageParts: imageParts.length > 0 ? imageParts : undefined,
    });

    let citationQuality = validateStrategyCitations({
      strategyRationales: result.strategyRationales,
      evidenceRefs: result.evidenceRefs as StrategyFieldRationale["evidenceRefs"],
      snapshot,
    });

    if (!citationQuality.passed) {
      const repairPrompt = `${strategyPrompt}\n\n${buildCitationRepairPrompt(citationQuality.invalidRefs, snapshot)}`;
      result = await generateResearchJson<StrategyResult>(repairPrompt, {
        tier: "pro",
        imageParts: imageParts.length > 0 ? imageParts : undefined,
      });
      citationQuality = validateStrategyCitations({
        strategyRationales: result.strategyRationales,
        evidenceRefs: result.evidenceRefs as StrategyFieldRationale["evidenceRefs"],
        snapshot,
      });
    }

    const rationales = (result.strategyRationales ?? []).filter(
      (r) => r?.field && r?.reasoning,
    ) as StrategyFieldRationale[];

    const actionPlan: ActionPlan | null = coerceActionPlan(
      result.actionPlan,
      "strategy",
      forbiddenBrands,
    );

    const strategicTensions =
      result.strategicTensions?.length
        ? result.strategicTensions
        : insightMemo.strategicTensions;

    const aiMeta = researchAiMetaFromSteps([
      buildResearchAiStep("Brand strategy insight memo", "pro"),
      buildResearchAiStep(
        imageParts.length > 0
          ? `Brand strategy synthesis (+${imageParts.length} visual images)`
          : "Brand strategy synthesis",
        "pro",
      ),
      ...(citationQuality.passed ? [] : [buildResearchAiStep("Citation repair pass", "pro")]),
    ]);

    await prisma.brandStrategyDocument.update({
      where: { id: documentId },
      data: {
        status: BrandStrategyStatus.READY,
        version: { increment: 1 },
        brandPurpose: result.brandPurpose,
        brandEssence: result.brandEssence,
        coreMessage: result.coreMessage,
        brandUsp: result.brandUsp,
        stp: result.stp as object,
        brandPersonality: result.brandPersonality as object,
        toneOfVoice: result.toneOfVoice as object,
        productLineStrategy: (result.productLineStrategy ?? []) as object,
        strategicTensions: strategicTensions as object,
        insightMemo: insightMemo as object,
        actionPlan: actionPlan ? (actionPlan as object) : undefined,
        citationQuality: citationQuality as object,
        evidenceRefs: (result.evidenceRefs ?? []) as object,
        strategyRationales: rationales as object,
        evidenceSnapshot: snapshot as object,
        generationConfig: config as object,
        aiMeta: aiMeta as object,
        errorMessage: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generasi strategi gagal.";
    await prisma.brandStrategyDocument.update({
      where: { id: documentId },
      data: { status: BrandStrategyStatus.FAILED, errorMessage: message },
    });
    throw err;
  }
}

export async function regenerateBrandStrategySection(
  documentId: string,
  userId: string,
  field: StrategySectionField,
): Promise<void> {
  const doc = await prisma.brandStrategyDocument.findFirst({
    where: { id: documentId },
  });
  if (!doc) throw new Error("Dokumen strategi tidak ditemukan.");
  if (!doc.insightMemo) {
    throw new Error("Regenerate section membutuhkan insight memo — regenerate dokumen penuh terlebih dahulu.");
  }

  const catalog = await getStrategySourceCatalog(userId, doc.ownerBrandId);
  const config =
    (doc.generationConfig as StrategyGenerationConfig | null) ??
    defaultStrategyGenerationConfig(catalog);

  await prisma.brandStrategyDocument.update({
    where: { id: documentId },
    data: { status: BrandStrategyStatus.GENERATING, errorMessage: null },
  });

  try {
    const readiness = await assessBrandEvidenceReadiness(userId, doc.ownerBrandId);
    const evidence = await gatherStrategyEvidence(
      userId,
      doc.ownerBrandId,
      config,
      catalog.visual,
      {
        category: doc.category ?? undefined,
        pmBrief: doc.pmBrief ?? undefined,
        demoFlags: readiness.demoFlags,
      },
    );

    const insightMemo = doc.insightMemo as InsightMemo;
    const forbiddenBrands = await gatherMarketBrandNames({
      category: doc.category ?? undefined,
    });

    const sectionResult = await generateResearchJson<SectionRegenResult>(
      buildBrandStrategySectionPrompt(
        field,
        evidence,
        insightMemo,
        documentFieldsForSection(doc),
        forbiddenBrands,
      ),
      { tier: "pro" },
    );

    const existingRationales = Array.isArray(doc.strategyRationales)
      ? (doc.strategyRationales as StrategyFieldRationale[])
      : [];
    const rationales = mergeRationales(existingRationales, [sectionResult.rationale]);

    const updateData: Record<string, unknown> = {
      status: BrandStrategyStatus.READY,
      version: { increment: 1 },
      strategyRationales: rationales as object,
    };

    if (field === "stp" || field === "brandPersonality" || field === "toneOfVoice") {
      updateData[field] = sectionResult.value as object;
    } else {
      updateData[field] = sectionResult.value as string;
    }

    await prisma.brandStrategyDocument.update({
      where: { id: documentId },
      data: updateData,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Regenerate section gagal.";
    await prisma.brandStrategyDocument.update({
      where: { id: documentId },
      data: { status: BrandStrategyStatus.FAILED, errorMessage: message },
    });
    throw err;
  }
}

export async function getBrandStrategyDocument(documentId: string, _userId: string) {
  return prisma.brandStrategyDocument.findFirst({
    where: { id: documentId },
    include: { creativeGuidelines: { orderBy: { updatedAt: "desc" }, take: 1 } },
  });
}

export async function listBrandStrategyDocuments(
  _userId: string,
  ownerBrandId?: string | null,
) {
  return prisma.brandStrategyDocument.findMany({
    where: brandStudioBrandFilter(ownerBrandId),
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
}

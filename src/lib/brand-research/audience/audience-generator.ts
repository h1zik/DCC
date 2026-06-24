import "server-only";

import { BrandAudienceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import { gatherStrategyEvidence } from "@/lib/brand-research/strategy/strategy-evidence-gather";
import { assessBrandEvidenceReadiness } from "@/lib/brand-research/strategy/evidence-gate";
import {
  defaultStrategyGenerationConfig,
  getStrategySourceCatalog,
} from "@/lib/brand-research/strategy/strategy-source-catalog";
import type {
  EvidenceSnapshot,
  StrategyGenerationConfig,
} from "@/lib/brand-research/strategy/evidence-types";
import { brandStudioBrandFilter } from "@/lib/brand-research/brand-studio-scope";
import { gatherMarketBrandNames } from "@/lib/research/brand-guard";
import { coerceActionPlan } from "@/lib/research/prescriptive/parse";
import type { ActionPlan } from "@/lib/research/prescriptive/types";
import {
  buildBrandAudiencePrompt,
  type AudienceResult,
} from "@/lib/brand-research/audience/prompts/brand-audience";

function isValidAudienceResult(result: AudienceResult): boolean {
  return (
    Array.isArray(result.personas) &&
    result.personas.length > 0 &&
    result.personas.every((p) => p && typeof p.name === "string" && !!p.motivations)
  );
}

export async function generateBrandAudienceProfile(
  profileId: string,
  userId: string,
  generationConfig?: StrategyGenerationConfig,
): Promise<void> {
  const profile = await prisma.brandAudienceProfile.findFirst({
    where: { id: profileId },
  });
  if (!profile) throw new Error("Profil audiens tidak ditemukan.");

  const catalog = await getStrategySourceCatalog(userId, profile.ownerBrandId);
  const config = generationConfig ?? defaultStrategyGenerationConfig(catalog);

  await prisma.brandAudienceProfile.update({
    where: { id: profileId },
    data: {
      status: BrandAudienceStatus.GENERATING,
      errorMessage: null,
      generationConfig: config as object,
    },
  });

  try {
    const readiness = await assessBrandEvidenceReadiness(
      userId,
      profile.ownerBrandId,
    );
    const evidence = await gatherStrategyEvidence(
      userId,
      profile.ownerBrandId,
      config,
      catalog.visual,
      {
        category: profile.category ?? undefined,
        pmBrief: profile.pmBrief ?? undefined,
        demoFlags: readiness.demoFlags,
      },
    );

    const snapshot: EvidenceSnapshot = {
      gatheredAt: new Date().toISOString(),
      ownerBrandId: profile.ownerBrandId,
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
        competitorSignals: evidence.competitorSignals,
        keywordThemes: evidence.keywordThemes,
        trendSignals: evidence.trendSignals,
        uspInsights: evidence.uspInsights,
        portfolioSummary: evidence.portfolioSummary,
        portfolioLines: evidence.portfolioLines,
      },
    };

    const forbiddenBrands = await gatherMarketBrandNames({
      category: profile.category ?? undefined,
    });

    const result = await generateResearchJson<AudienceResult>(
      buildBrandAudiencePrompt(evidence, forbiddenBrands),
      { tier: "pro", validate: isValidAudienceResult },
    );

    const actionPlan: ActionPlan | null = coerceActionPlan(
      result.actionPlan,
      "strategy",
      forbiddenBrands,
    );

    const aiMeta = researchAiMetaFromSteps([
      buildResearchAiStep("Audience persona synthesis", "pro"),
    ]);

    await prisma.brandAudienceProfile.update({
      where: { id: profileId },
      data: {
        status: BrandAudienceStatus.READY,
        version: { increment: 1 },
        personas: (result.personas ?? []) as object,
        aiSummary: result.aiSummary ?? null,
        actionPlan: actionPlan ? (actionPlan as object) : undefined,
        evidenceRefs: (result.evidenceRefs ?? []) as object,
        evidenceSnapshot: snapshot as object,
        generationConfig: config as object,
        aiMeta: aiMeta as object,
        errorMessage: null,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Generasi profil audiens gagal.";
    await prisma.brandAudienceProfile.update({
      where: { id: profileId },
      data: { status: BrandAudienceStatus.FAILED, errorMessage: message },
    });
    throw err;
  }
}

export async function getBrandAudienceProfile(profileId: string) {
  return prisma.brandAudienceProfile.findFirst({
    where: { id: profileId },
  });
}

export async function listBrandAudienceProfiles(
  _userId: string,
  ownerBrandId?: string | null,
) {
  return prisma.brandAudienceProfile.findMany({
    where: brandStudioBrandFilter(ownerBrandId),
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
}

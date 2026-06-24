import "server-only";

import { randomUUID } from "node:crypto";
import { ProductInnovationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  researchAiMetaFromSteps,
} from "@/lib/research/llm";
import { gatherConceptContext } from "@/lib/research/concept-lab/gather-concept-context";
import type { ContextModules } from "@/lib/research/usp-gap/gather-context";
import { gatherMarketBrandNames } from "@/lib/research/brand-guard";
import { buildScamperPrompt } from "@/lib/research/product-innovation/prompts/scamper";
import {
  SCAMPER_TECHNIQUE_KEYS,
  type ScamperIdea,
  type ScamperResult,
} from "@/lib/research/product-innovation/types";

function normalizeIdeas(result: ScamperResult): ScamperIdea[] {
  if (!Array.isArray(result.ideas)) return [];
  return result.ideas
    .filter((d) => d && typeof d.title === "string" && d.title.trim().length > 0)
    .map((d) => ({
      id: randomUUID(),
      technique: SCAMPER_TECHNIQUE_KEYS.includes(d.technique)
        ? d.technique
        : "SUBSTITUTE",
      title: d.title.trim(),
      description: d.description ?? "",
      rationale: d.rationale ?? "",
      change: d.change ?? "",
      benefit: d.benefit ?? "",
      feasibilityNote: d.feasibilityNote,
      promotedConceptId: null,
    }));
}

export async function generateProductInnovation(
  innovationId: string,
): Promise<void> {
  const innovation = await prisma.productInnovation.findUnique({
    where: { id: innovationId },
  });
  if (!innovation) throw new Error("Sesi inovasi tidak ditemukan.");

  const sourceModules =
    innovation.sourceModules && typeof innovation.sourceModules === "object"
      ? (innovation.sourceModules as ContextModules)
      : {};

  await prisma.productInnovation.update({
    where: { id: innovationId },
    data: { status: ProductInnovationStatus.GENERATING, errorMessage: null },
  });

  try {
    const context = await gatherConceptContext({
      category: innovation.category,
      sourceModules,
    });

    const forbiddenBrands = await gatherMarketBrandNames({
      category: innovation.category,
    });

    const result = await generateResearchJson<ScamperResult>(
      buildScamperPrompt({
        baseProduct: innovation.baseProduct,
        category: innovation.category,
        targetMarket: innovation.targetMarket,
        priceTargetMin: innovation.priceTargetMin,
        priceTargetMax: innovation.priceTargetMax,
        context,
        riskFactors: context.riskFactors,
        forbiddenBrands,
      }),
      {
        tier: "pro",
        validate: (parsed) =>
          Array.isArray(parsed.ideas) && parsed.ideas.length > 0,
      },
    );

    const ideas = normalizeIdeas(result);
    if (ideas.length === 0) {
      throw new Error("AI tidak menghasilkan ide SCAMPER yang valid.");
    }

    const aiMeta = researchAiMetaFromSteps([
      buildResearchAiStep("SCAMPER ideation", "pro"),
    ]);

    await prisma.productInnovation.update({
      where: { id: innovationId },
      data: {
        status: ProductInnovationStatus.READY,
        ideas: ideas as object,
        riskFactors: context.riskFactors as object,
        evidenceSnapshot: {
          gatheredAt: new Date().toISOString(),
          aiSummary: result.aiSummary ?? null,
          context,
        } as object,
        aiMeta: aiMeta as object,
        errorMessage: null,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Generasi inovasi gagal.";
    await prisma.productInnovation.update({
      where: { id: innovationId },
      data: { status: ProductInnovationStatus.FAILED, errorMessage: message },
    });
    throw err;
  }
}

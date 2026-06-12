import "server-only";

import { ProductConceptStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import { gatherConceptContext } from "@/lib/research/concept-lab/gather-concept-context";
import { buildConceptValidationPrompt } from "@/lib/research/concept-lab/prompts/concept-validation";
import {
  parseConceptData,
  parseValidationScores,
  type ValidationScores,
} from "@/lib/research/concept-lab/types";
import type { ContextModules } from "@/lib/research/usp-gap/gather-context";

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function validateProductConceptById(
  conceptId: string,
): Promise<ValidationScores> {
  const concept = await prisma.productConcept.findUnique({
    where: { id: conceptId },
  });
  if (!concept) throw new Error("Konsep tidak ditemukan.");

  const conceptData = parseConceptData(concept.conceptData);
  const sourceModules =
    concept.sourceModules && typeof concept.sourceModules === "object"
      ? (concept.sourceModules as ContextModules)
      : {};

  await prisma.productConcept.update({
    where: { id: conceptId },
    data: { status: ProductConceptStatus.VALIDATING },
  });

  try {
    const context = await gatherConceptContext({
      category: concept.category,
      sourceModules,
      uspGapAnalysisId: concept.uspGapAnalysisId,
      uspIndex: concept.uspIndex,
    });

    const prompt = buildConceptValidationPrompt({
      category: concept.category,
      targetMarket: concept.targetMarket,
      priceTargetMin: concept.priceTargetMin,
      priceTargetMax: concept.priceTargetMax,
      conceptData,
      context,
    });

    const result = await generateResearchJson<ValidationScores>(prompt);
    const scores: ValidationScores = {
      marketDemand: clampScore(result.marketDemand ?? 0),
      differentiation: clampScore(result.differentiation ?? 0),
      pricingFit: clampScore(result.pricingFit ?? 0),
      overall: clampScore(
        result.overall ??
          ((result.marketDemand ?? 0) +
            (result.differentiation ?? 0) +
            (result.pricingFit ?? 0)) /
            3,
      ),
      risks: result.risks ?? [],
      aiSummary: result.aiSummary ?? "",
    };

    await prisma.productConcept.update({
      where: { id: conceptId },
      data: {
        validationScores: scores,
        status: ProductConceptStatus.READY,
      },
    });

    return scores;
  } catch (err) {
    await prisma.productConcept.update({
      where: { id: conceptId },
      data: { status: ProductConceptStatus.DRAFT },
    });
    throw err;
  }
}

export async function getValidationScores(
  conceptId: string,
): Promise<ValidationScores> {
  const concept = await prisma.productConcept.findUnique({
    where: { id: conceptId },
  });
  if (!concept) throw new Error("Konsep tidak ditemukan.");
  return parseValidationScores(concept.validationScores);
}

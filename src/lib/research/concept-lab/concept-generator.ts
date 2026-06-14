import "server-only";

import { ProductConceptMode, ProductConceptStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  mergeResearchAiMeta,
} from "@/lib/research/llm";
import { gatherConceptContext } from "@/lib/research/concept-lab/gather-concept-context";
import { buildConceptGenerationPrompt } from "@/lib/research/concept-lab/prompts/concept-generation";
import type { ConceptData } from "@/lib/research/concept-lab/types";
import { validateProductConceptById } from "@/lib/research/concept-lab/concept-validator";
import type { ContextModules } from "@/lib/research/usp-gap/gather-context";

export async function generateProductConcept(conceptId: string): Promise<void> {
  const concept = await prisma.productConcept.findUnique({
    where: { id: conceptId },
  });
  if (!concept) throw new Error("Konsep tidak ditemukan.");

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

    const prompt = buildConceptGenerationPrompt({
      category: concept.category,
      targetMarket: concept.targetMarket,
      priceTargetMin: concept.priceTargetMin,
      priceTargetMax: concept.priceTargetMax,
      context,
    });

    const result = await generateResearchJson<ConceptData>(prompt, {
      tier: "pro",
    });

    if (context.uspCandidate && !result.positioningStatement) {
      result.positioningStatement = context.uspCandidate.usp;
      result.keyClaims = [
        context.uspCandidate.usp,
        ...(result.keyClaims ?? []),
      ].slice(0, 5);
    }

    await prisma.productConcept.update({
      where: { id: conceptId },
      data: {
        conceptData: result,
        mode: ProductConceptMode.AI_GENERATED,
        aiMeta: mergeResearchAiMeta(
          concept.aiMeta,
          buildResearchAiStep("Generate konsep", "pro"),
        ) as object,
      },
    });

    await validateProductConceptById(conceptId);
  } catch (err) {
    await prisma.productConcept.update({
      where: { id: conceptId },
      data: { status: ProductConceptStatus.DRAFT },
    });
    throw err;
  }
}

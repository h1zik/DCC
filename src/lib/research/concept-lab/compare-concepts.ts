import "server-only";

import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  researchAiMetaFromSteps,
  type ResearchAiMeta,
} from "@/lib/research/llm";
import { buildConceptComparisonPrompt } from "@/lib/research/concept-lab/prompts/concept-comparison";
import {
  parseConceptData,
  parseValidationScores,
  type ConceptComparisonResult,
} from "@/lib/research/concept-lab/types";

export async function compareProductConcepts(
  ids: string[],
): Promise<ConceptComparisonResult & { aiMeta: ResearchAiMeta }> {
  if (ids.length < 2 || ids.length > 3) {
    throw new Error("Pilih 2–3 konsep untuk dibandingkan.");
  }

  const concepts = await prisma.productConcept.findMany({
    where: { id: { in: ids } },
  });

  if (concepts.length !== ids.length) {
    throw new Error("Satu atau lebih konsep tidak ditemukan.");
  }

  const payload = concepts.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category,
    conceptData: parseConceptData(c.conceptData),
    validationScores: parseValidationScores(c.validationScores),
  }));

  const prompt = buildConceptComparisonPrompt(payload);
  const result = await generateResearchJson<ConceptComparisonResult>(prompt, {
    tier: "pro",
  });

  return {
    summary: result.summary ?? "",
    dimensions: result.dimensions ?? [],
    winnerId: result.winnerId ?? null,
    recommendation: result.recommendation ?? "",
    aiMeta: researchAiMetaFromSteps([
      buildResearchAiStep("Perbandingan konsep", "pro"),
    ]),
  };
}

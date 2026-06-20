import "server-only";

import { ProductConceptStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResearchJson } from "@/lib/research/gemini-client";
import {
  buildResearchAiStep,
  mergeResearchAiMeta,
} from "@/lib/research/llm";
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

function blendValidationScores(
  scores: ValidationScores,
  context: Awaited<ReturnType<typeof gatherConceptContext>>,
  priceTargetMin: number | null,
  priceTargetMax: number | null,
): ValidationScores {
  let pricingFit = scores.pricingFit;
  let overall = scores.overall;
  const notes: string[] = [];

  const priceRange = context.competitor?.priceRange;
  if (
    priceRange &&
    priceTargetMin != null &&
    priceTargetMax != null &&
    priceRange.max > priceRange.min
  ) {
    const mid = (priceTargetMin + priceTargetMax) / 2;
    const marketMid = (priceRange.min + priceRange.max) / 2;
    const spread = priceRange.max - priceRange.min;
    const deviation = Math.abs(mid - marketMid) / spread;
    if (deviation > 0.45) {
      const penalty = Math.min(25, Math.round(deviation * 30));
      pricingFit = clampScore(pricingFit - penalty);
      notes.push(
        `Target harga konsep (${Math.round(mid).toLocaleString("id-ID")}) jauh dari median kompetitor.`,
      );
    }
  }

  const modulesWithData = [
    context.reviewIntel,
    context.competitor,
    context.trendRadar,
    context.keywordIntel,
    context.socialListening,
  ].filter(Boolean).length;

  if (modulesWithData <= 1) {
    overall = clampScore(Math.min(overall, 72));
    notes.push("Validasi berbasis ≤1 modul riset — tingkatkan cakupan data sebelum GO.");
  }

  if (context.uspCandidate) {
    const floor = context.uspCandidate.differentiationScore - 12;
    const differentiation = clampScore(
      Math.max(scores.differentiation, floor),
    );
    overall = clampScore(
      Math.round((differentiation + pricingFit + scores.marketDemand) / 3),
    );
    return {
      ...scores,
      pricingFit,
      differentiation,
      overall,
      decisionReason: [scores.decisionReason, ...notes].filter(Boolean).join(" "),
    };
  }

  overall = clampScore(
    Math.round((scores.differentiation + pricingFit + scores.marketDemand) / 3),
  );

  return {
    ...scores,
    pricingFit,
    overall,
    decisionReason: [scores.decisionReason, ...notes].filter(Boolean).join(" "),
  };
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

    const result = await generateResearchJson<ValidationScores>(prompt, {
      tier: "pro",
    });
    const decision =
      result.decision === "GO" || result.decision === "NO_GO"
        ? result.decision
        : "PIVOT";
    const scores: ValidationScores = blendValidationScores(
      {
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
        decision,
        decisionReason: result.decisionReason ?? "",
      },
      context,
      concept.priceTargetMin,
      concept.priceTargetMax,
    );

    await prisma.productConcept.update({
      where: { id: conceptId },
      data: {
        validationScores: scores,
        riskFactors: context.riskFactors,
        status: ProductConceptStatus.READY,
        aiMeta: mergeResearchAiMeta(
          concept.aiMeta,
          buildResearchAiStep("Validasi skor", "pro"),
        ) as object,
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

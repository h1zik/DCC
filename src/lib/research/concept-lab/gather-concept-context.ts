import "server-only";

import { prisma } from "@/lib/prisma";
import {
  gatherUspContext,
  type ContextModules,
  type UspGatheredContext,
} from "@/lib/research/usp-gap/gather-context";

export type ConceptContext = UspGatheredContext & {
  uspCandidate: {
    usp: string;
    rtb: string;
    differentiationScore: number;
    risks: string[];
  } | null;
};

export async function gatherConceptContext(input: {
  category: string;
  sourceModules: ContextModules;
  uspGapAnalysisId?: string | null;
  uspIndex?: number | null;
}): Promise<ConceptContext> {
  const ctx = await gatherUspContext({
    category: input.category,
    contextModules: input.sourceModules,
  });

  let uspCandidate: ConceptContext["uspCandidate"] = null;

  if (input.uspGapAnalysisId != null) {
    const analysis = await prisma.uspGapAnalysis.findUnique({
      where: { id: input.uspGapAnalysisId },
      include: { result: true },
    });

    if (analysis?.result) {
      const candidates = Array.isArray(analysis.result.uspCandidates)
        ? (analysis.result.uspCandidates as {
            usp: string;
            rtb: string;
            differentiationScore: number;
            risks: string[];
          }[])
        : [];
      const idx = input.uspIndex ?? 0;
      uspCandidate = candidates[idx] ?? candidates[0] ?? null;
    }
  }

  return { ...ctx, uspCandidate };
}

import "server-only";

import { prisma } from "@/lib/prisma";
import {
  gatherUspContext,
  type ContextModules,
  type UspGatheredContext,
} from "@/lib/research/usp-gap/gather-context";
import type { RiskFactor } from "@/lib/research/concept-lab/types";

export type ConceptContext = UspGatheredContext & {
  uspCandidate: {
    usp: string;
    rtb: string;
    differentiationScore: number;
    risks: string[];
  } | null;
  /** Deterministically mapped risks from upstream evidence (review/social). */
  riskFactors: RiskFactor[];
};

function severityFromCount(count: number): RiskFactor["severity"] {
  if (count >= 8) return "HIGH";
  if (count >= 3) return "MED";
  return "LOW";
}

/**
 * Build explicit, traceable risk factors from the gathered context so a real
 * complaint (e.g. "tekstur lengket") becomes a visible validation risk linked
 * back to its source module — not an opaque LLM guess.
 */
export function deriveRiskFactors(context: UspGatheredContext): RiskFactor[] {
  const risks: RiskFactor[] = [];

  for (const c of context.reviewIntel?.topComplaints ?? []) {
    risks.push({
      label: `Keluhan pasar: ${c.theme}`,
      severity: severityFromCount(c.count),
      source: { module: "review-intelligence", label: `${c.theme} (${c.count}x)` },
    });
  }

  for (const p of context.socialListening?.topPainPoints ?? []) {
    risks.push({
      label: `Pain point sosial: ${p.theme}`,
      severity: severityFromCount(p.count),
      source: { module: "social-listening", label: `${p.theme} (${p.count}x)` },
    });
  }

  return risks
    .sort((a, b) => {
      const rank = { HIGH: 0, MED: 1, LOW: 2 } as const;
      return rank[a.severity] - rank[b.severity];
    })
    .slice(0, 8);
}

export async function gatherConceptContext(input: {
  category: string;
  sourceModules: ContextModules;
  uspGapAnalysisId?: string | null;
  uspIndex?: number | null;
}): Promise<ConceptContext> {
  const { context } = await gatherUspContext({
    category: input.category,
    contextModules: input.sourceModules,
  });

  const riskFactors = deriveRiskFactors(context);

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

  return { ...context, uspCandidate, riskFactors };
}

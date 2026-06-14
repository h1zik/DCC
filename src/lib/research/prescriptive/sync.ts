import "server-only";

import { RecOwner, RecStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ActionPlan } from "./types";

const OWNER_SET = new Set<RecOwner>([
  RecOwner.MARKETING,
  RecOwner.RND,
  RecOwner.PRICING,
  RecOwner.FINANCE,
  RecOwner.SUPPLY,
  RecOwner.BRAND,
]);

function toOwner(value: string): RecOwner {
  const upper = value.toUpperCase() as RecOwner;
  return OWNER_SET.has(upper) ? upper : RecOwner.MARKETING;
}

/**
 * Persist an ActionPlan's recommendations into ResearchRecommendation so they
 * surface in the cross-module dashboard Action Center. Replaces any prior OPEN
 * recommendations for the same (module, sourceId) to avoid duplicates on
 * re-analysis. DISMISSED/CONVERTED rows are left intact.
 */
export async function syncModuleRecommendations(input: {
  module: string;
  sourceId: string;
  sourceLabel?: string | null;
  href?: string | null;
  plan: ActionPlan | null;
}): Promise<void> {
  const { module, sourceId, sourceLabel, href, plan } = input;

  await prisma.researchRecommendation.deleteMany({
    where: { module, sourceId, status: RecStatus.OPEN },
  });

  if (!plan || plan.recommendations.length === 0) return;

  await prisma.researchRecommendation.createMany({
    data: plan.recommendations.map((rec) => ({
      module,
      sourceId,
      sourceLabel: sourceLabel ?? null,
      href: href ?? null,
      owner: toOwner(rec.owner),
      priority: rec.priority,
      action: rec.action,
      rationale: rec.rationale,
      expectedImpact: rec.expectedImpact || null,
      metricToWatch: rec.metricToWatch || null,
      evidence: rec.evidence,
      confidence: rec.confidence,
      effort: rec.effort,
      horizon: rec.horizon,
    })),
  });
}

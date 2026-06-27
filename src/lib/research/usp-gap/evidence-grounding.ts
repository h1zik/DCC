import "server-only";

import type { ActionPlan } from "@/lib/research/prescriptive/types";
import type { UspGatheredContext } from "@/lib/research/usp-gap/gather-context";

function pushStr(acc: string[], value: unknown): void {
  if (typeof value === "string" && value.trim().length > 0) {
    acc.push(value.toLowerCase());
  }
}

/**
 * Flatten every meaningful string in the gathered context into one lowercase
 * corpus. Used to verify that AI-emitted evidence (gap matrix evidenceRefs,
 * action-plan evidence labels) is actually grounded in the input data rather
 * than hallucinated.
 */
export function buildEvidenceCorpus(ctx: UspGatheredContext): string {
  const parts: string[] = [];
  pushStr(parts, ctx.category);

  if (ctx.reviewIntel) {
    ctx.reviewIntel.topComplaints.forEach((t) => pushStr(parts, t.theme));
    ctx.reviewIntel.topPraises.forEach((t) => pushStr(parts, t.theme));
    pushStr(parts, ctx.reviewIntel.gapOpportunity);
    ctx.reviewIntel.sourceProducts.forEach((p) => pushStr(parts, p));
  }
  if (ctx.competitor) {
    ctx.competitor.brands.forEach((b) => pushStr(parts, b));
    ctx.competitor.skuNames.forEach((s) => pushStr(parts, s));
    ctx.competitor.claims.forEach((c) => pushStr(parts, c));
  }
  if (ctx.trendRadar) {
    ctx.trendRadar.items.forEach((i) => {
      pushStr(parts, i.name);
      pushStr(parts, i.narrative);
    });
  }
  if (ctx.keywordIntel) {
    ctx.keywordIntel.gapKeywords.forEach((k) => pushStr(parts, k.keyword));
    ctx.keywordIntel.clusters.forEach((c) => {
      pushStr(parts, c.name);
      c.keywords.forEach((k) => pushStr(parts, k));
    });
    pushStr(parts, ctx.keywordIntel.aiSummary);
  }
  if (ctx.socialListening) {
    ctx.socialListening.topPainPoints.forEach((t) => pushStr(parts, t.theme));
    ctx.socialListening.topWishlist.forEach((t) => pushStr(parts, t.theme));
    pushStr(parts, ctx.socialListening.aiSummary);
  }
  ctx.productDiscovery?.forEach((q) =>
    pushStr(parts, JSON.stringify(q).toLowerCase()),
  );
  ctx.competitorProducts?.forEach((c) =>
    pushStr(parts, JSON.stringify(c).toLowerCase()),
  );

  return parts.join(" \n ");
}

const STOPWORDS = new Set([
  "yang",
  "dan",
  "atau",
  "untuk",
  "dari",
  "dengan",
  "pada",
  "this",
  "that",
  "with",
  "from",
  "adalah",
  "tidak",
]);

function significantTokens(text: string): { words: string[]; numbers: string[] } {
  const lower = text.toLowerCase();
  const words = (lower.match(/[a-z]{4,}/g) ?? []).filter(
    (w) => !STOPWORDS.has(w),
  );
  const numbers = lower.match(/\d+/g) ?? [];
  return { words, numbers };
}

/**
 * True when enough of an evidence label's significant tokens appear in the
 * corpus. Lenient on purpose (the model paraphrases): half the meaningful
 * words must be present. Labels with only numbers require at least one hit.
 */
export function isGrounded(ref: string, corpus: string): boolean {
  if (typeof ref !== "string") return false;
  const { words, numbers } = significantTokens(ref);
  if (words.length === 0 && numbers.length === 0) return false;

  if (words.length === 0) {
    return numbers.some((n) => corpus.includes(n));
  }

  const wordHits = words.filter((w) => corpus.includes(w)).length;
  return wordHits / words.length >= 0.5;
}

/** Keep only the evidence refs that are grounded in the corpus. */
export function groundEvidenceRefs(
  refs: string[] | undefined,
  corpus: string,
): string[] {
  if (!Array.isArray(refs)) return [];
  return refs.filter((r) => isGrounded(r, corpus));
}

/**
 * Strip ungrounded evidence from every recommendation. Recommendations are
 * kept (the action itself can still be valid) but their evidence chips will
 * only show labels that trace back to real input data.
 */
export function groundActionPlan(
  plan: ActionPlan | null,
  corpus: string,
): ActionPlan | null {
  if (!plan) return null;
  return {
    ...plan,
    recommendations: plan.recommendations.map((rec) => ({
      ...rec,
      evidence: rec.evidence.filter((e) => isGrounded(e.label, corpus)),
    })),
  };
}

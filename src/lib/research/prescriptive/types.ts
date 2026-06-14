/**
 * Canonical prescriptive "Action Plan" contract shared across every Research Hub
 * module. Analyzers emit this shape, the DB stores it, and the UI renders it.
 *
 * This file is intentionally framework-agnostic (no "server-only") so both the
 * server analyzers and the client UI kit can import it.
 */

export type RecOwner =
  | "MARKETING"
  | "RND"
  | "PRICING"
  | "FINANCE"
  | "SUPPLY"
  | "BRAND";

export type RecPriority = "P0" | "P1" | "P2";
export type RecEffort = "LOW" | "MED" | "HIGH";
export type RecHorizon = "NOW" | "30D" | "QUARTER";

/** Which Research Hub module a piece of evidence / a recommendation came from. */
export type ResearchModuleKey =
  | "product-discovery"
  | "review-intelligence"
  | "competitor-tracker"
  | "trend-radar"
  | "keyword-intel"
  | "social-listening"
  | "usp-analyzer"
  | "concept-lab"
  | "research-reports";

export type RecEvidence = {
  /** Originating module (one of ResearchModuleKey, kept as string for forward-compat). */
  module: string;
  /** Optional id of the originating record (sourceId, digestId, etc.). */
  refId?: string;
  /** Human-readable evidence label, e.g. "Keluhan: tekstur lengket (24x)". */
  label: string;
};

export type Recommendation = {
  id: string;
  owner: RecOwner;
  priority: RecPriority;
  /** Imperative instruction, e.g. "Reformulasi agar tekstur tidak lengket". */
  action: string;
  /** Why this matters, tied to the evidence. */
  rationale: string;
  evidence: RecEvidence[];
  /** Expected business impact if executed. */
  expectedImpact: string;
  /** KPI to watch after executing. */
  metricToWatch?: string;
  /** Model confidence 0..1. */
  confidence: number;
  effort: RecEffort;
  horizon: RecHorizon;
};

export type ActionPlan = {
  /** One-line decision headline for the whole plan. */
  headline: string;
  recommendations: Recommendation[];
};

export const REC_OWNER_LABELS: Record<RecOwner, string> = {
  MARKETING: "Marketing",
  RND: "R&D / Formulasi",
  PRICING: "Pricing",
  FINANCE: "Finance",
  SUPPLY: "Supply / Sourcing",
  BRAND: "Brand / Positioning",
};

export const REC_PRIORITY_RANK: Record<RecPriority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
};

/** Sort key: P0 highest, ties broken by confidence desc. */
export function recommendationScore(rec: Recommendation): number {
  const priorityWeight = (3 - REC_PRIORITY_RANK[rec.priority]) * 10;
  return priorityWeight + Math.max(0, Math.min(1, rec.confidence)) * 5;
}

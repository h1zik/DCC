import { z } from "zod";
import { sanitizeActionPlan as applyBrandSanitize } from "@/lib/research/brand-guard-sanitize";
import type {
  ActionPlan,
  RecEffort,
  RecHorizon,
  RecOwner,
  RecPriority,
  Recommendation,
} from "./types";

const OWNERS: RecOwner[] = [
  "MARKETING",
  "RND",
  "PRICING",
  "FINANCE",
  "SUPPLY",
  "BRAND",
];
const PRIORITIES: RecPriority[] = ["P0", "P1", "P2"];
const EFFORTS: RecEffort[] = ["LOW", "MED", "HIGH"];
const HORIZONS: RecHorizon[] = ["NOW", "30D", "QUARTER"];

const evidenceSchema = z.object({
  module: z.string().trim().default("research-reports"),
  refId: z.string().trim().optional(),
  label: z.string().trim().min(1),
});

const recommendationSchema = z.object({
  owner: z.string().trim(),
  priority: z.string().trim().optional(),
  action: z.string().trim().min(1),
  rationale: z.string().trim().default(""),
  evidence: z.array(evidenceSchema).default([]),
  expectedImpact: z.string().trim().default(""),
  metricToWatch: z.string().trim().optional(),
  confidence: z.coerce.number().optional(),
  effort: z.string().trim().optional(),
  horizon: z.string().trim().optional(),
});

const actionPlanSchema = z.object({
  headline: z.string().trim().default(""),
  recommendations: z.array(recommendationSchema).default([]),
});

function pickEnum<T extends string>(
  raw: string | undefined,
  allowed: T[],
  fallback: T,
): T {
  if (!raw) return fallback;
  const upper = raw.toUpperCase().trim();
  const match = allowed.find((a) => a === upper);
  return match ?? fallback;
}

function clampConfidence(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.6;
  // Tolerate models returning 0-100.
  const normalized = value > 1 ? value / 100 : value;
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Lenient coercion of a raw `actionPlan` blob (from Gemini) into a typed,
 * normalized ActionPlan. Returns null when there is nothing usable so callers
 * can decide whether to trigger a repair retry.
 */
export function coerceActionPlan(
  raw: unknown,
  idPrefix = "rec",
  forbiddenBrands?: string[],
): ActionPlan | null {
  if (raw == null || typeof raw !== "object") return null;

  const parsed = actionPlanSchema.safeParse(raw);
  if (!parsed.success) return null;

  const recommendations: Recommendation[] = parsed.data.recommendations
    .filter((r) => r.action.trim().length > 0)
    .map((r, idx) => ({
      id: `${idPrefix}-${idx + 1}`,
      owner: pickEnum<RecOwner>(r.owner, OWNERS, "MARKETING"),
      priority: pickEnum<RecPriority>(r.priority, PRIORITIES, "P1"),
      action: r.action,
      rationale: r.rationale,
      evidence: r.evidence
        .filter((e) => e.label.trim().length > 0)
        .map((e) => ({ module: e.module, refId: e.refId, label: e.label })),
      expectedImpact: r.expectedImpact,
      metricToWatch: r.metricToWatch,
      confidence: clampConfidence(r.confidence),
      effort: pickEnum<RecEffort>(r.effort, EFFORTS, "MED"),
      horizon: pickEnum<RecHorizon>(r.horizon, HORIZONS, "30D"),
    }));

  if (recommendations.length === 0) return null;

  const plan: ActionPlan = {
    headline: parsed.data.headline,
    recommendations,
  };

  if (forbiddenBrands?.length) {
    return applyBrandSanitize(plan, forbiddenBrands);
  }

  return plan;
}

/** Type guard for a stored ActionPlan JSON value (e.g. from Prisma Json column). */
export function asActionPlan(value: unknown): ActionPlan | null {
  return coerceActionPlan(value, "rec");
}

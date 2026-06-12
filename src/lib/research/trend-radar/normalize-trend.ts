import "server-only";

import { TrendDimension, TrendPhase } from "@prisma/client";

const VALID_DIMENSIONS = new Set<string>(Object.values(TrendDimension));
const VALID_PHASES = new Set<string>(Object.values(TrendPhase));

const DIMENSION_ALIASES: Record<string, TrendDimension> = {
  BRAND: TrendDimension.BRAND,
  COMPETITOR: TrendDimension.BRAND,
  PLAYER: TrendDimension.BRAND,
  RETAILER: TrendDimension.BRAND,
  BENEFIT: TrendDimension.CLAIM,
  CONCERN: TrendDimension.CLAIM,
  PRODUCT: TrendDimension.CATEGORY,
  SKU: TrendDimension.CATEGORY,
  TYPE: TrendDimension.FORMAT,
};

export function normalizeTrendDimension(raw: unknown): TrendDimension {
  const key = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (VALID_DIMENSIONS.has(key)) return key as TrendDimension;
  if (key in DIMENSION_ALIASES) return DIMENSION_ALIASES[key]!;
  return TrendDimension.CLAIM;
}

export function normalizeTrendPhase(raw: unknown): TrendPhase {
  const key = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (VALID_PHASES.has(key)) return key as TrendPhase;
  return TrendPhase.GROWING;
}

export function clampTrendScore(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

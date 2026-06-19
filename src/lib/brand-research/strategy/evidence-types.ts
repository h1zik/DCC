/** Shared types for Brand Strategy evidence — safe for client import. */

import type { StrategyVisualCatalog } from "@/lib/brand-research/strategy/strategy-visual-config";

export type EvidenceCheck = {
  key: string;
  label: string;
  met: boolean;
  count: number;
  required: boolean;
  href: string;
  detail?: string;
};

export type EvidenceWarning = {
  key: string;
  label: string;
  href: string;
  detail: string;
};

export type DemoFlag = {
  module: string;
  label: string;
  detail: string;
};

export type StructuredSourceRef = {
  module: string;
  sourceId: string;
  label: string;
  href: string;
};

export type EvidenceRef = {
  field: string;
  source: string;
  sourceId?: string;
  snippet: string;
  href?: string;
};

export type StrategySourceKey =
  | "review"
  | "social"
  | "visual"
  | "competitor"
  | "keyword"
  | "trend"
  | "usp";

export type StrategySourceSelection = {
  enabled: boolean;
  ids: string[];
};

export type StrategyGenerationConfig = {
  review: StrategySourceSelection;
  social: StrategySourceSelection;
  visual: StrategySourceSelection & {
    analyzeImages: boolean;
    maxSamples: number;
  };
  competitor: StrategySourceSelection;
  keyword: StrategySourceSelection;
  trend: StrategySourceSelection;
  usp: StrategySourceSelection;
};

export type StrategyFieldRationale = {
  field: string;
  label: string;
  reasoning: string;
  evidenceRefs: EvidenceRef[];
  confidence?: "high" | "medium" | "low";
};

export type StrategySourceCatalogItem = {
  id: string;
  label: string;
  detail?: string;
};

export type StrategySourceCatalog = {
  review: StrategySourceCatalogItem[];
  social: StrategySourceCatalogItem[];
  competitor: StrategySourceCatalogItem[];
  keyword: StrategySourceCatalogItem[];
  trend: StrategySourceCatalogItem[];
  usp: StrategySourceCatalogItem[];
  visual: StrategyVisualCatalog;
};

export type EvidenceReadiness = {
  canGenerate: boolean;
  checks: EvidenceCheck[];
  warnings: EvidenceWarning[];
  demoFlags: DemoFlag[];
};

export type EvidenceSnapshot = {
  gatheredAt: string;
  ownerBrandId: string | null;
  readiness: EvidenceReadiness;
  sourceRefs: StructuredSourceRef[];
  input: Record<string, unknown>;
};

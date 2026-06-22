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
  | "usp"
  | "productDiscovery";

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
  productDiscovery: StrategySourceSelection;
};

export type StrategyFieldRationale = {
  field: string;
  label: string;
  reasoning: string;
  evidenceRefs: EvidenceRef[];
  confidence?: "high" | "medium" | "low";
};

export type StrategicTension = {
  tension: string;
  poleA: string;
  poleB: string;
  recommendation: string;
};

export type RepresentativeQuote = {
  source: "review" | "social";
  sourceId: string;
  text: string;
  sentiment: "positive" | "negative" | "neutral";
};

export type InsightMemo = {
  executiveSummary: string;
  voiceOfCustomer: {
    pains: string[];
    desires: string[];
    representativeQuotes: RepresentativeQuote[];
  };
  visualDirection: {
    palette: {
      primary: string;
      secondary: string;
      accent: string;
      neutrals: string[];
    } | null;
    topTags: string[];
    aestheticNotes: string;
  };
  marketContext: {
    keywordThemes: string[];
    trendSignals: string[];
    competitiveWhitespace: string[];
  };
  strategicTensions: StrategicTension[];
  demoDataWarnings: string[];
};

export type CitationQualityReport = {
  score: number;
  totalRefs: number;
  validRefs: number;
  passed: boolean;
  invalidRefs: {
    field: string;
    source: string;
    sourceId?: string;
    reason: string;
  }[];
};

export type StrategySectionField =
  | "brandPurpose"
  | "brandEssence"
  | "coreMessage"
  | "brandUsp"
  | "stp"
  | "brandPersonality"
  | "toneOfVoice";

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
  productDiscovery: StrategySourceCatalogItem[];
  visual: StrategyVisualCatalog;
};

export type PortfolioLineEvidence = {
  lineId: string;
  name: string;
  category: string | null;
  description: string | null;
  targetAudience: string | null;
  role: string | null;
  productDiscoveryQueryId: string | null;
  linkedDiscoveryKeyword: string | null;
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

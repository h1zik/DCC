import "server-only";

export type ConceptData = {
  nameOptions: string[];
  selectedName?: string;
  positioningStatement: string;
  heroIngredients: { name: string; reason: string }[];
  textureFormat: string;
  keyClaims: string[];
  packagingDirection: string;
  estimatedCogsRange: { min: number; max: number };
  competitorComparison: string;
  whyItWillWin: string;
};

export type ValidationScores = {
  marketDemand: number;
  differentiation: number;
  pricingFit: number;
  overall: number;
  risks: string[];
  aiSummary: string;
};

export type ConceptComparisonResult = {
  summary: string;
  dimensions: {
    label: string;
    scores: { conceptId: string; conceptTitle: string; score: number; note: string }[];
  }[];
  winnerId: string | null;
  recommendation: string;
};

export function emptyConceptData(): ConceptData {
  return {
    nameOptions: [],
    positioningStatement: "",
    heroIngredients: [],
    textureFormat: "",
    keyClaims: [],
    packagingDirection: "",
    estimatedCogsRange: { min: 0, max: 0 },
    competitorComparison: "",
    whyItWillWin: "",
  };
}

export function emptyValidationScores(): ValidationScores {
  return {
    marketDemand: 0,
    differentiation: 0,
    pricingFit: 0,
    overall: 0,
    risks: [],
    aiSummary: "",
  };
}

export function parseConceptData(raw: unknown): ConceptData {
  if (!raw || typeof raw !== "object") return emptyConceptData();
  const o = raw as Record<string, unknown>;
  return {
    nameOptions: Array.isArray(o.nameOptions)
      ? (o.nameOptions as string[])
      : [],
    selectedName:
      typeof o.selectedName === "string" ? o.selectedName : undefined,
    positioningStatement:
      typeof o.positioningStatement === "string"
        ? o.positioningStatement
        : "",
    heroIngredients: Array.isArray(o.heroIngredients)
      ? (o.heroIngredients as ConceptData["heroIngredients"])
      : [],
    textureFormat: typeof o.textureFormat === "string" ? o.textureFormat : "",
    keyClaims: Array.isArray(o.keyClaims) ? (o.keyClaims as string[]) : [],
    packagingDirection:
      typeof o.packagingDirection === "string" ? o.packagingDirection : "",
    estimatedCogsRange:
      o.estimatedCogsRange &&
      typeof o.estimatedCogsRange === "object" &&
      "min" in (o.estimatedCogsRange as object)
        ? (o.estimatedCogsRange as ConceptData["estimatedCogsRange"])
        : { min: 0, max: 0 },
    competitorComparison:
      typeof o.competitorComparison === "string" ? o.competitorComparison : "",
    whyItWillWin:
      typeof o.whyItWillWin === "string" ? o.whyItWillWin : "",
  };
}

export function parseValidationScores(raw: unknown): ValidationScores {
  if (!raw || typeof raw !== "object") return emptyValidationScores();
  const o = raw as Record<string, unknown>;
  return {
    marketDemand: typeof o.marketDemand === "number" ? o.marketDemand : 0,
    differentiation:
      typeof o.differentiation === "number" ? o.differentiation : 0,
    pricingFit: typeof o.pricingFit === "number" ? o.pricingFit : 0,
    overall: typeof o.overall === "number" ? o.overall : 0,
    risks: Array.isArray(o.risks) ? (o.risks as string[]) : [],
    aiSummary: typeof o.aiSummary === "string" ? o.aiSummary : "",
  };
}

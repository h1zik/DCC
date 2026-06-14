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

export type ConceptDecision = "GO" | "PIVOT" | "NO_GO";

export type ValidationScores = {
  marketDemand: number;
  differentiation: number;
  pricingFit: number;
  overall: number;
  risks: string[];
  aiSummary: string;
  decision: ConceptDecision;
  decisionReason: string;
};

/** Deterministic risk factor mapped from upstream evidence (e.g. review complaints). */
export type RiskFactor = {
  label: string;
  severity: "HIGH" | "MED" | "LOW";
  source: { module: string; label: string; href?: string };
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
    decision: "PIVOT",
    decisionReason: "",
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
  const decisionRaw =
    typeof o.decision === "string" ? o.decision.toUpperCase() : "";
  const decision: ConceptDecision =
    decisionRaw === "GO" || decisionRaw === "NO_GO" ? decisionRaw : "PIVOT";
  return {
    marketDemand: typeof o.marketDemand === "number" ? o.marketDemand : 0,
    differentiation:
      typeof o.differentiation === "number" ? o.differentiation : 0,
    pricingFit: typeof o.pricingFit === "number" ? o.pricingFit : 0,
    overall: typeof o.overall === "number" ? o.overall : 0,
    risks: Array.isArray(o.risks) ? (o.risks as string[]) : [],
    aiSummary: typeof o.aiSummary === "string" ? o.aiSummary : "",
    decision,
    decisionReason:
      typeof o.decisionReason === "string" ? o.decisionReason : "",
  };
}

export function parseRiskFactors(raw: unknown): RiskFactor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (x): x is RiskFactor =>
        typeof x === "object" && x != null && "label" in x,
    )
    .map((x) => ({
      label: String((x as RiskFactor).label),
      severity: (["HIGH", "MED", "LOW"] as const).includes(
        (x as RiskFactor).severity,
      )
        ? (x as RiskFactor).severity
        : "MED",
      source:
        typeof (x as RiskFactor).source === "object" && (x as RiskFactor).source
          ? (x as RiskFactor).source
          : { module: "", label: "" },
    }));
}

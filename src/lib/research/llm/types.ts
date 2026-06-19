export type ResearchLlmProvider = "gemini" | "ollama-cloud";

/** Flash = bulk/fast jobs; Pro = strategic reasoning jobs. */
export type ResearchModelTier = "flash" | "pro";

export type LlmImagePart = {
  mimeType: string;
  data: string;
  label?: string;
};

export type OllamaThinkLevel =
  | false
  | true
  | "low"
  | "medium"
  | "high"
  | "max";

export type GenerateResearchJsonOpts<T> = {
  maxRetries?: number;
  validate?: (parsed: T) => boolean;
  /** Defaults to flash. Pass pro for trend, reports, concept lab, USP, action plans. */
  tier?: ResearchModelTier;
  /** Inline image parts for multimodal Gemini (vision) analysis. */
  imageParts?: LlmImagePart[];
};

export type GenerateResearchTextOpts = {
  tier?: ResearchModelTier;
  maxRetries?: number;
};

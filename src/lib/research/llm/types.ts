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
  /** Hanya coba model pertama — hindari spam fallback saat safety block. */
  singleModel?: boolean;
  /** Jangan log per-model warning (mis. moderasi gambar massal). */
  quiet?: boolean;
  /**
   * Dipanggil dengan nama model yang BENAR-BENAR menjawab (setelah fallback).
   * Pakai ini saat membangun aiMeta agar badge model tidak salah atribusi.
   */
  onModelUsed?: (model: string) => void;
};

export type GenerateResearchTextOpts = {
  tier?: ResearchModelTier;
  maxRetries?: number;
  /** Dipanggil dengan nama model yang benar-benar menjawab. */
  onModelUsed?: (model: string) => void;
};

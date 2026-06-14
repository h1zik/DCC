import type { ResearchModelTier } from "./types";

/** Default model Ollama Cloud — selaras dengan RESEARCH_OLLAMA_MODEL_* di .env */
export const RESEARCH_DEFAULT_OLLAMA_MODELS = {
  flash: "deepseek-v4-flash:cloud",
  pro: "deepseek-v4-pro:cloud",
} as const;

export function defaultOllamaModelForTier(tier: ResearchModelTier): string {
  return tier === "pro"
    ? RESEARCH_DEFAULT_OLLAMA_MODELS.pro
    : RESEARCH_DEFAULT_OLLAMA_MODELS.flash;
}

import type { ResearchModelTier } from "./types";

/**
 * Default model Ollama Cloud — selaras dengan RESEARCH_OLLAMA_MODEL_* di .env.
 * Kedua tier memakai Kimi K3.1 Pro; perbedaannya ada di level thinking
 * (flash = tanpa thinking, pro = thinking aktif — lihat resolveOllamaThink).
 */
export const RESEARCH_DEFAULT_OLLAMA_MODELS = {
  flash: "kimi-k3.1-pro:cloud",
  pro: "kimi-k3.1-pro:cloud",
} as const;

export function defaultOllamaModelForTier(tier: ResearchModelTier): string {
  return tier === "pro"
    ? RESEARCH_DEFAULT_OLLAMA_MODELS.pro
    : RESEARCH_DEFAULT_OLLAMA_MODELS.flash;
}

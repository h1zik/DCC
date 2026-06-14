import "server-only";

import type {
  OllamaThinkLevel,
  ResearchLlmProvider,
  ResearchModelTier,
} from "./types";
import { RESEARCH_DEFAULT_OLLAMA_MODELS } from "./defaults";

const DEFAULT_OLLAMA_BASE = "https://ollama.com";
const DEFAULT_FLASH = RESEARCH_DEFAULT_OLLAMA_MODELS.flash;
const DEFAULT_PRO = RESEARCH_DEFAULT_OLLAMA_MODELS.pro;

export function resolveResearchProvider(): ResearchLlmProvider {
  const raw = process.env.RESEARCH_LLM_PROVIDER?.trim().toLowerCase();
  if (raw === "ollama" || raw === "ollama-cloud") {
    if (resolveOllamaApiKey()) return "ollama-cloud";
    console.warn(
      "[research/llm] RESEARCH_LLM_PROVIDER=ollama-cloud tapi OLLAMA_API_KEY kosong — fallback ke Gemini",
    );
    return "gemini";
  }
  return "gemini";
}

export function resolveOllamaApiKey(): string | null {
  return process.env.OLLAMA_API_KEY?.trim() || null;
}

export function resolveOllamaBaseUrl(): string {
  const base = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE;
  return base.replace(/\/+$/, "");
}

export function resolveOllamaModel(tier: ResearchModelTier): string {
  if (tier === "pro") {
    return (
      process.env.RESEARCH_OLLAMA_MODEL_PRO?.trim() ||
      process.env.RESEARCH_OLLAMA_MODEL?.trim() ||
      DEFAULT_PRO
    );
  }
  return (
    process.env.RESEARCH_OLLAMA_MODEL_FLASH?.trim() ||
    process.env.RESEARCH_OLLAMA_MODEL?.trim() ||
    DEFAULT_FLASH
  );
}

export function resolveOllamaThink(tier: ResearchModelTier): OllamaThinkLevel {
  if (tier === "flash") {
    const flash = process.env.RESEARCH_OLLAMA_THINK_FLASH?.trim().toLowerCase();
    if (flash === "false" || flash === "off" || flash === "none") return false;
    if (flash === "true" || flash === "on") return true;
    if (
      flash === "low" ||
      flash === "medium" ||
      flash === "high" ||
      flash === "max"
    ) {
      return flash;
    }
    return false;
  }

  const pro = process.env.RESEARCH_OLLAMA_THINK_PRO?.trim().toLowerCase();
  if (pro === "false" || pro === "off" || pro === "none") return false;
  if (pro === "true" || pro === "on") return true;
  if (pro === "low" || pro === "medium" || pro === "high" || pro === "max") {
    return pro;
  }
  return "high";
}

export function assertResearchProviderConfigured(
  provider: ResearchLlmProvider,
): void {
  if (provider === "ollama-cloud") {
    if (!resolveOllamaApiKey()) {
      throw new Error(
        "OLLAMA_API_KEY belum diset. Buat di https://ollama.com/settings/keys dan set RESEARCH_LLM_PROVIDER=ollama-cloud",
      );
    }
    return;
  }

  const geminiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim();
  if (!geminiKey) {
    throw new Error(
      "GEMINI_API_KEY belum diset. Dapatkan gratis di https://aistudio.google.com/apikey",
    );
  }
}

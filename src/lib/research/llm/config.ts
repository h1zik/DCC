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

const DEFAULT_GEMINI_FLASH = "gemini-2.5-flash-lite";
const DEFAULT_GEMINI_PRO = "gemini-2.5-pro";

/**
 * Model Gemini per tier. Tier "pro" (report, USP, concept lab, trend, action
 * plan) memakai model reasoning yang lebih kuat — sebelumnya tier diabaikan
 * dan semua job jalan di flash-lite meski badge UI menampilkan "Pro".
 */
export function resolveGeminiModel(tier: ResearchModelTier): string {
  if (tier === "pro") {
    return (
      process.env.GEMINI_MODEL_PRO?.trim() ||
      process.env.GEMINI_MODEL?.trim() ||
      DEFAULT_GEMINI_PRO
    );
  }
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_FLASH;
}

/** Urutan kandidat model Gemini untuk satu panggilan (primary + fallback). */
export function resolveGeminiModelCandidates(
  tier: ResearchModelTier,
): string[] {
  const primary = resolveGeminiModel(tier);
  const fallbacks =
    tier === "pro"
      ? ["gemini-2.5-flash", DEFAULT_GEMINI_FLASH]
      : ["gemini-2.5-flash", "gemini-flash-latest"];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [primary, ...fallbacks]) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

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

/**
 * Provider per tier — mis. flash di Gemini (murah, job massal) sementara pro
 * di DeepSeek V4 Pro via Ollama Cloud (report/USP/concept/trend).
 * Override via RESEARCH_LLM_PROVIDER_PRO / RESEARCH_LLM_PROVIDER_FLASH;
 * bila kosong, ikut RESEARCH_LLM_PROVIDER global.
 */
export function resolveResearchProviderForTier(
  tier: ResearchModelTier,
): ResearchLlmProvider {
  const raw = (
    tier === "pro"
      ? process.env.RESEARCH_LLM_PROVIDER_PRO
      : process.env.RESEARCH_LLM_PROVIDER_FLASH
  )
    ?.trim()
    .toLowerCase();

  if (raw === "ollama" || raw === "ollama-cloud") {
    if (resolveOllamaApiKey()) return "ollama-cloud";
    console.warn(
      `[research/llm] provider tier ${tier}=ollama-cloud tapi OLLAMA_API_KEY kosong — fallback ke Gemini`,
    );
    return "gemini";
  }
  if (raw === "gemini") return "gemini";
  return resolveResearchProvider();
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

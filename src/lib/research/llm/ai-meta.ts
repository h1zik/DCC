import "server-only";

import type { ResearchLlmProvider, ResearchModelTier } from "./types";
import {
  resolveResearchProviderForTier,
  resolveGeminiModel,
  resolveOllamaModel,
} from "./config";

export type ResearchAiModelStep = {
  /** Langkah analisis, mis. "Klasifikasi review". */
  label: string;
  tier: ResearchModelTier;
  provider: ResearchLlmProvider;
  /** Nama model API, mis. deepseek-v4-flash:cloud */
  model: string;
  generatedAt: string;
  /** Versi/hash prompt yang dipakai — untuk reproduksibilitas output. */
  promptVersion?: string;
  /** Pesan error bila langkah AI gagal — UI wajib menampilkan, bukan konten kosong. */
  error?: string;
};

export type ResearchAiMeta = {
  steps: ResearchAiModelStep[];
};

function resolveModelName(tier: ResearchModelTier): string {
  const provider = resolveResearchProviderForTier(tier);
  if (provider === "ollama-cloud") {
    return resolveOllamaModel(tier);
  }
  return resolveGeminiModel(tier);
}

export function buildResearchAiStep(
  label: string,
  tier: ResearchModelTier,
  opts?: {
    /** Model yang benar-benar menjawab (dari onModelUsed) — bukan sekadar model terkonfigurasi. */
    actualModel?: string;
    promptVersion?: string;
    /** Diisi bila langkah gagal; badge model akan menandai output tidak tersedia. */
    error?: string;
  },
): ResearchAiModelStep {
  return {
    label,
    tier,
    provider: resolveResearchProviderForTier(tier),
    model: opts?.actualModel || resolveModelName(tier),
    generatedAt: new Date().toISOString(),
    ...(opts?.promptVersion ? { promptVersion: opts.promptVersion } : {}),
    ...(opts?.error ? { error: opts.error } : {}),
  };
}

export function researchAiMetaFromSteps(
  steps: ResearchAiModelStep[],
): ResearchAiMeta {
  return { steps };
}

export function mergeResearchAiMeta(
  existing: unknown,
  ...steps: ResearchAiModelStep[]
): ResearchAiMeta {
  const parsed = parseResearchAiMeta(existing);
  const merged = [...(parsed?.steps ?? [])];

  for (const step of steps) {
    const idx = merged.findIndex(
      (s) => s.label === step.label && s.tier === step.tier,
    );
    if (idx >= 0) merged[idx] = step;
    else merged.push(step);
  }

  return { steps: merged };
}

export function parseResearchAiMeta(raw: unknown): ResearchAiMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const steps = (raw as ResearchAiMeta).steps;
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const valid = steps.filter(
    (s): s is ResearchAiModelStep =>
      typeof s === "object" &&
      s != null &&
      typeof s.label === "string" &&
      (s.tier === "flash" || s.tier === "pro") &&
      typeof s.model === "string",
  );

  return valid.length > 0 ? { steps: valid } : null;
}

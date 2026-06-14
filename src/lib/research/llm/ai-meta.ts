import "server-only";

import type { ResearchLlmProvider, ResearchModelTier } from "./types";
import {
  resolveResearchProvider,
  resolveOllamaModel,
} from "./config";
import { resolveAgentModel } from "@/lib/agent/provider";

export type ResearchAiModelStep = {
  /** Langkah analisis, mis. "Klasifikasi review". */
  label: string;
  tier: ResearchModelTier;
  provider: ResearchLlmProvider;
  /** Nama model API, mis. deepseek-v4-flash:cloud */
  model: string;
  generatedAt: string;
};

export type ResearchAiMeta = {
  steps: ResearchAiModelStep[];
};

function resolveModelName(tier: ResearchModelTier): string {
  const provider = resolveResearchProvider();
  if (provider === "ollama-cloud") {
    return resolveOllamaModel(tier);
  }
  return resolveAgentModel();
}

export function buildResearchAiStep(
  label: string,
  tier: ResearchModelTier,
): ResearchAiModelStep {
  return {
    label,
    tier,
    provider: resolveResearchProvider(),
    model: resolveModelName(tier),
    generatedAt: new Date().toISOString(),
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

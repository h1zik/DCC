import "server-only";

import {
  assertResearchProviderConfigured,
  resolveResearchProvider,
} from "./config";
import { geminiGenerateJson, geminiGenerateText } from "./gemini-adapter";
import { ollamaGenerateJson, ollamaGenerateText } from "./ollama-adapter";
import type { GenerateResearchJsonOpts, GenerateResearchTextOpts } from "./types";

export type {
  GenerateResearchJsonOpts,
  GenerateResearchTextOpts,
  LlmImagePart,
  ResearchLlmProvider,
  ResearchModelTier,
} from "./types";

export { extractJson } from "./extract-json";
export {
  buildResearchAiStep,
  mergeResearchAiMeta,
  parseResearchAiMeta,
  researchAiMetaFromSteps,
} from "./ai-meta";
export type { ResearchAiMeta, ResearchAiModelStep } from "./ai-meta";

export async function generateResearchJson<T>(
  prompt: string,
  opts?: GenerateResearchJsonOpts<T>,
): Promise<T> {
  const provider = resolveResearchProvider();
  assertResearchProviderConfigured(provider);

  if (provider === "ollama-cloud") {
    return ollamaGenerateJson(prompt, opts);
  }
  return geminiGenerateJson(prompt, opts);
}

export async function generateResearchText(
  prompt: string,
  opts?: GenerateResearchTextOpts,
): Promise<string> {
  const provider = resolveResearchProvider();
  assertResearchProviderConfigured(provider);

  if (provider === "ollama-cloud") {
    return ollamaGenerateText(prompt, opts);
  }
  return geminiGenerateText(prompt, opts);
}

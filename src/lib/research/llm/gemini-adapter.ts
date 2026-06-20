import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  resolveAgentApiKey,
  resolveAgentModelCandidates,
} from "@/lib/agent/provider";
import { parseExtractedJson } from "./extract-json";
import { withLlmRetry } from "./retry";
import type { GenerateResearchJsonOpts, GenerateResearchTextOpts } from "./types";

export async function geminiGenerateJson<T>(
  prompt: string,
  opts?: GenerateResearchJsonOpts<T>,
): Promise<T> {
  const apiKey = resolveAgentApiKey();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY belum diset. Dapatkan gratis di https://aistudio.google.com/apikey",
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const models = resolveAgentModelCandidates();
  let lastError: unknown;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> =
        [{ text: prompt }];
      for (const img of opts?.imageParts ?? []) {
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      }

      const result = await withLlmRetry(
        () => model.generateContent(parts),
        { maxRetries: opts?.maxRetries ?? 2 },
      );

      const text = result.response.text();
      const parsed = parseExtractedJson<T>(text);

      if (opts?.validate && !opts.validate(parsed)) {
        throw new Error("Validasi struktur JSON gagal.");
      }
      return parsed;
    } catch (err) {
      lastError = err;
      console.warn(`[research/llm/gemini] model ${modelName} gagal`, err);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gagal memanggil Gemini untuk analisis riset.");
}

export async function geminiGenerateText(
  prompt: string,
  opts?: GenerateResearchTextOpts,
): Promise<string> {
  const apiKey = resolveAgentApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diset.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: resolveAgentModelCandidates()[0]!,
    generationConfig: { temperature: 0.3 },
  });

  const result = await withLlmRetry(() => model.generateContent(prompt), {
    maxRetries: opts?.maxRetries ?? 2,
  });
  return result.response.text().trim();
}

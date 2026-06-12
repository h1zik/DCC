import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  resolveAgentApiKey,
  resolveAgentModelCandidates,
  withGeminiRetry,
} from "@/lib/agent/provider";

export async function generateResearchJson<T>(
  prompt: string,
  opts?: { maxRetries?: number },
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

      const result = await withGeminiRetry(
        () => model.generateContent(prompt),
        { maxRetries: opts?.maxRetries ?? 2 },
      );

      const text = result.response.text().trim();
      const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
      return JSON.parse(cleaned) as T;
    } catch (err) {
      lastError = err;
      console.warn(`[research/gemini] model ${modelName} gagal`, err);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gagal memanggil Gemini untuk analisis riset.");
}

export async function generateResearchText(
  prompt: string,
): Promise<string> {
  const apiKey = resolveAgentApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY belum diset.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: resolveAgentModelCandidates()[0]!,
    generationConfig: { temperature: 0.3 },
  });

  const result = await withGeminiRetry(() => model.generateContent(prompt));
  return result.response.text().trim();
}

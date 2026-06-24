import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiResponseBlockedError, isGeminiResponseBlockedError } from "./gemini-blocked-error";
import { parseExtractedJson } from "./extract-json";
import { withLlmRetry } from "./retry";
import type { GenerateResearchJsonOpts, GenerateResearchTextOpts } from "./types";

export { GeminiResponseBlockedError, isGeminiResponseBlockedError } from "./gemini-blocked-error";

function readGeminiBlockReason(
  response: Awaited<
    ReturnType<ReturnType<GoogleGenerativeAI["getGenerativeModel"]>["generateContent"]>
  >["response"],
): string | null {
  const feedbackReason = response.promptFeedback?.blockReason;
  if (feedbackReason) return String(feedbackReason);

  for (const candidate of response.candidates ?? []) {
    const reason = candidate.finishReason;
    if (reason === "SAFETY" || reason === "BLOCKLIST") return reason;
  }

  return null;
}

function resolveGeminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    null
  );
}

function resolveGeminiModelCandidates(): string[] {
  const primary =
    process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";
  const fallbacks = ["gemini-2.5-flash", "gemini-flash-latest"];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [primary, ...fallbacks]) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export async function geminiGenerateJson<T>(
  prompt: string,
  opts?: GenerateResearchJsonOpts<T>,
): Promise<T> {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY belum diset. Dapatkan gratis di https://aistudio.google.com/apikey",
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const models = opts?.singleModel
    ? resolveGeminiModelCandidates().slice(0, 1)
    : resolveGeminiModelCandidates();
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

      const blockReason = readGeminiBlockReason(result.response);
      if (blockReason) {
        throw new GeminiResponseBlockedError(blockReason);
      }

      let text: string;
      try {
        text = result.response.text();
      } catch (err) {
        if (isGeminiResponseBlockedError(err)) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("blocked")) {
          throw new GeminiResponseBlockedError(msg);
        }
        throw err;
      }

      const parsed = parseExtractedJson<T>(text);

      if (opts?.validate && !opts.validate(parsed)) {
        throw new Error("Validasi struktur JSON gagal.");
      }
      return parsed;
    } catch (err) {
      lastError = err;
      if (err instanceof GeminiResponseBlockedError) {
        throw err;
      }
      if (!opts?.quiet) {
        console.warn(`[research/llm/gemini] model ${modelName} gagal`, err);
      }
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
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum diset.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: resolveGeminiModelCandidates()[0]!,
    generationConfig: { temperature: 0.3 },
  });

  const result = await withLlmRetry(() => model.generateContent(prompt), {
    maxRetries: opts?.maxRetries ?? 2,
  });
  return result.response.text().trim();
}

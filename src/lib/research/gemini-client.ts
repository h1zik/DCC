import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  resolveAgentApiKey,
  resolveAgentModelCandidates,
  withGeminiRetry,
} from "@/lib/agent/provider";

/**
 * Extract a JSON object/array from a raw model response. Strips markdown
 * fences and, as a last resort, slices from the first `{`/`[` to the matching
 * last bracket so trailing prose doesn't break `JSON.parse`.
 */
function extractJson(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
  text = text.replace(/```\s*$/i, "").trim();

  try {
    JSON.parse(text);
    return text;
  } catch {
    /* fall through to bracket slicing */
  }

  const firstObj = text.indexOf("{");
  const firstArr = text.indexOf("[");
  const start =
    firstObj === -1
      ? firstArr
      : firstArr === -1
        ? firstObj
        : Math.min(firstObj, firstArr);
  if (start === -1) return text;

  const openChar = text[start];
  const closeChar = openChar === "{" ? "}" : "]";
  const end = text.lastIndexOf(closeChar);
  if (end > start) return text.slice(start, end + 1);
  return text;
}

export async function generateResearchJson<T>(
  prompt: string,
  opts?: { maxRetries?: number; validate?: (parsed: T) => boolean },
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

      const text = result.response.text();
      const parsed = JSON.parse(extractJson(text)) as T;

      if (opts?.validate && !opts.validate(parsed)) {
        throw new Error("Validasi struktur JSON gagal.");
      }
      return parsed;
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

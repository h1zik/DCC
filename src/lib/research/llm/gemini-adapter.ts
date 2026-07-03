import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiResponseBlockedError, isGeminiResponseBlockedError } from "./gemini-blocked-error";
import { resolveGeminiModelCandidates } from "./config";
import { isJsonParseError, parseExtractedJson } from "./extract-json";
import { withLlmRetry } from "./retry";
import type { GenerateResearchJsonOpts, GenerateResearchTextOpts } from "./types";

const JSON_REPAIR_SUFFIX =
  "\n\nPERINGATAN: Respons sebelumnya bukan JSON valid. " +
  "Output HARUS satu objek JSON parsable saja — tanpa kalimat penjelasan dalam bahasa Indonesia atau Inggris.";

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
  const tier = opts?.tier ?? "flash";
  const models = opts?.singleModel
    ? resolveGeminiModelCandidates(tier).slice(0, 1)
    : resolveGeminiModelCandidates(tier);
  const parseAttempts = Math.max(1, (opts?.maxRetries ?? 2) + 1);
  let lastError: unknown;

  for (const modelName of models) {
    // Repair loop: respons non-JSON di-retry dengan suffix peringatan +
    // temperature lebih rendah, bukan langsung pindah model (paritas Ollama).
    for (let attempt = 0; attempt < parseAttempts; attempt += 1) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: attempt === 0 ? 0.2 : 0.1,
          },
        });

        const attemptPrompt =
          attempt === 0 ? prompt : `${prompt}${JSON_REPAIR_SUFFIX}`;
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> =
          [{ text: attemptPrompt }];
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
        opts?.onModelUsed?.(modelName);
        return parsed;
      } catch (err) {
        lastError = err;
        if (err instanceof GeminiResponseBlockedError) {
          throw err;
        }

        const validationFailed =
          err instanceof Error &&
          err.message === "Validasi struktur JSON gagal.";
        const repairable = isJsonParseError(err) || validationFailed;
        if (repairable && attempt < parseAttempts - 1) {
          if (!opts?.quiet) {
            console.warn(
              `[research/llm/gemini] model ${modelName} JSON tidak valid (attempt ${attempt + 1}/${parseAttempts}), retry…`,
            );
          }
          continue;
        }

        if (!opts?.quiet) {
          console.warn(`[research/llm/gemini] model ${modelName} gagal`, err);
        }
        break;
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
  const modelName = resolveGeminiModelCandidates(opts?.tier ?? "flash")[0]!;
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { temperature: 0.3 },
  });

  const result = await withLlmRetry(() => model.generateContent(prompt), {
    maxRetries: opts?.maxRetries ?? 2,
  });
  opts?.onModelUsed?.(modelName);
  return result.response.text().trim();
}

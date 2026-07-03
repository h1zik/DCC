import "server-only";

import {
  resolveOllamaApiKey,
  resolveOllamaBaseUrl,
  resolveOllamaModel,
  resolveOllamaThink,
} from "./config";
import { isJsonParseError, parseExtractedJson } from "./extract-json";
import { withLlmRetry } from "./retry";
import type {
  GenerateResearchJsonOpts,
  GenerateResearchTextOpts,
  OllamaThinkLevel,
  ResearchModelTier,
} from "./types";

type OllamaChatResponse = {
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
  };
  error?: string;
};

function jsonPromptSuffix(): string {
  return (
    "\n\nBalas HANYA dengan satu objek JSON valid (bukan array di root kecuali diminta)." +
    " Tanpa markdown fence, tanpa penjelasan, tanpa teks sebelum/sesudah JSON."
  );
}

const JSON_REPAIR_SUFFIX =
  "\n\nPERINGATAN: Respons sebelumnya bukan JSON valid. " +
  "Output HARUS satu objek JSON parsable saja — tanpa kalimat penjelasan dalam bahasa Indonesia atau Inggris.";

async function ollamaChat(
  prompt: string,
  tier: ResearchModelTier,
  opts: {
    json: boolean;
    temperature: number;
    maxRetries?: number;
  },
): Promise<string> {
  const apiKey = resolveOllamaApiKey();
  if (!apiKey) {
    throw new Error("OLLAMA_API_KEY belum diset.");
  }

  const model = resolveOllamaModel(tier);
  const think = resolveOllamaThink(tier);
  const baseUrl = resolveOllamaBaseUrl();
  const content = opts.json ? `${prompt}${jsonPromptSuffix()}` : prompt;

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content }],
    stream: false,
    think: think as OllamaThinkLevel,
    options: { temperature: opts.temperature },
  };

  if (opts.json) {
    body.format = "json";
  }

  return withLlmRetry(
    async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = (await res.json()) as OllamaChatResponse;

      if (!res.ok) {
        const detail =
          payload.error ||
          (typeof payload === "object" && payload !== null
            ? JSON.stringify(payload)
            : res.statusText);
        const err = new Error(
          `Ollama Cloud error ${res.status}: ${detail}`,
        ) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }

      const text = payload.message?.content?.trim();
      if (!text) {
        throw new Error(
          `Ollama Cloud (${model}) mengembalikan respons kosong.`,
        );
      }

      return text;
    },
    { maxRetries: opts.maxRetries ?? 2 },
  );
}

export async function ollamaGenerateJson<T>(
  prompt: string,
  opts?: GenerateResearchJsonOpts<T>,
): Promise<T> {
  const tier = opts?.tier ?? "flash";
  const model = resolveOllamaModel(tier);
  const parseAttempts = Math.max(1, (opts?.maxRetries ?? 2) + 1);
  let lastError: unknown;

  for (let attempt = 0; attempt < parseAttempts; attempt += 1) {
    const attemptPrompt =
      attempt === 0 ? prompt : `${prompt}${JSON_REPAIR_SUFFIX}`;

    try {
      const text = await ollamaChat(attemptPrompt, tier, {
        json: true,
        temperature: attempt === 0 ? 0.2 : 0.1,
        maxRetries: opts?.maxRetries,
      });

      const parsed = parseExtractedJson<T>(text);

      if (opts?.validate && !opts.validate(parsed)) {
        throw new Error("Validasi struktur JSON gagal.");
      }

      opts?.onModelUsed?.(model);
      return parsed;
    } catch (err) {
      lastError = err;
      const validationFailed =
        err instanceof Error && err.message === "Validasi struktur JSON gagal.";
      const shouldRetry =
        attempt < parseAttempts - 1 &&
        (isJsonParseError(err) || validationFailed);

      if (shouldRetry) {
        console.warn(
          `[research/llm/ollama] model ${model} JSON tidak valid (attempt ${attempt + 1}/${parseAttempts}), retry…`,
        );
        continue;
      }

      console.warn(`[research/llm/ollama] model ${model} gagal`, err);
      break;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gagal memanggil Ollama Cloud untuk analisis riset.");
}

export async function ollamaGenerateText(
  prompt: string,
  opts?: GenerateResearchTextOpts,
): Promise<string> {
  const tier = opts?.tier ?? "flash";
  const text = await ollamaChat(prompt, tier, {
    json: false,
    temperature: 0.3,
    maxRetries: opts?.maxRetries,
  });
  opts?.onModelUsed?.(resolveOllamaModel(tier));
  return text;
}

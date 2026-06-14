import "server-only";

import {
  resolveOllamaApiKey,
  resolveOllamaBaseUrl,
  resolveOllamaModel,
  resolveOllamaThink,
} from "./config";
import { extractJson } from "./extract-json";
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
  return "\n\nBalas HANYA dengan JSON valid. Tanpa markdown fence, tanpa penjelasan di luar JSON.";
}

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

  try {
    const text = await ollamaChat(prompt, tier, {
      json: true,
      temperature: 0.2,
      maxRetries: opts?.maxRetries,
    });

    const parsed = JSON.parse(extractJson(text)) as T;

    if (opts?.validate && !opts.validate(parsed)) {
      throw new Error("Validasi struktur JSON gagal.");
    }

    return parsed;
  } catch (err) {
    console.warn(`[research/llm/ollama] model ${model} gagal`, err);
    throw err instanceof Error
      ? err
      : new Error("Gagal memanggil Ollama Cloud untuk analisis riset.");
  }
}

export async function ollamaGenerateText(
  prompt: string,
  opts?: GenerateResearchTextOpts,
): Promise<string> {
  const tier = opts?.tier ?? "flash";
  return ollamaChat(prompt, tier, {
    json: false,
    temperature: 0.3,
    maxRetries: opts?.maxRetries,
  });
}

import "server-only";

import { dataForSeoLive } from "@/lib/seo/dataforseo/client";
import { withDataForSeoCache } from "@/lib/seo/dataforseo/cache";

/**
 * Wrapper DataForSEO AI Optimization API — jawaban LLM (ChatGPT/Gemini/
 * Perplexity) untuk satu prompt, dipakai AI Visibility Tracker.
 *
 * API ini masih baru & bentuk responsnya bisa bergeser antar model, jadi
 * parsing dibuat SANGAT defensif: kumpulkan semua string teks + semua URL
 * dari struktur respons apa pun.
 */

export type AiPlatform = "chatgpt" | "gemini" | "perplexity";

export const AI_PLATFORM_LABELS: Record<AiPlatform, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

const PLATFORM_CONFIG: Record<
  AiPlatform,
  { endpoint: string; model: string }
> = {
  chatgpt: {
    endpoint: "ai_optimization/chat_gpt/llm_responses/live",
    model: "gpt-4o-mini",
  },
  gemini: {
    endpoint: "ai_optimization/gemini/llm_responses/live",
    model: "gemini-2.0-flash",
  },
  perplexity: {
    endpoint: "ai_optimization/perplexity/llm_responses/live",
    model: "sonar",
  },
};

export type LlmAnswer = {
  text: string;
  citations: string[];
};

/** Kunci yang berisi teks jawaban di berbagai bentuk respons. */
const TEXT_KEYS = new Set(["text", "content", "answer", "message"]);
/** Kunci yang berisi URL sitasi. */
const URL_KEYS = new Set(["url", "source_url", "link"]);
/** Cabang yang tidak berisi jawaban (hemat traversal). */
const SKIP_KEYS = new Set(["input_tokens", "output_tokens", "money_spent"]);

/** Kumpulkan teks & URL dari struktur respons apa pun (pure, di-export untuk test). */
export function collectLlmAnswer(node: unknown): LlmAnswer {
  const texts: string[] = [];
  const urls = new Set<string>();

  const walk = (value: unknown, keyHint: string | null) => {
    if (value == null) return;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (/^https?:\/\//i.test(trimmed)) {
        if (keyHint && URL_KEYS.has(keyHint)) urls.add(trimmed);
        return;
      }
      if (keyHint && TEXT_KEYS.has(keyHint) && trimmed.length > 1) {
        texts.push(trimmed);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item, keyHint);
      return;
    }
    if (typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (SKIP_KEYS.has(key)) continue;
        walk(child, key);
      }
    }
  };
  walk(node, null);

  return { text: texts.join("\n"), citations: [...urls] };
}

/**
 * Tanyakan satu prompt ke platform AI. Cache TTL default berlaku (24 jam) —
 * cukup untuk cek berkala tanpa biaya ganda di hari yang sama.
 */
export async function fetchLlmResponse(
  platform: AiPlatform,
  prompt: string,
): Promise<LlmAnswer> {
  const config = PLATFORM_CONFIG[platform];
  const payload = {
    user_prompt: prompt.slice(0, 500),
    model_name: config.model,
    web_search: true,
  };

  const result = await withDataForSeoCache(config.endpoint, payload, async () => {
    return await dataForSeoLive<unknown>(config.endpoint, payload, {
      maxRetries: 1,
    });
  });

  return collectLlmAnswer(result);
}

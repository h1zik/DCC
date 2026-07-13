import "server-only";

import {
  dataForSeoGet,
  dataForSeoLive,
  DataForSeoError,
  DFS_OK,
} from "@/lib/seo/dataforseo/client";
import { withDataForSeoCache } from "@/lib/seo/dataforseo/cache";

/**
 * Wrapper DataForSEO AI Optimization API — jawaban LLM (ChatGPT/Gemini/
 * Claude/Perplexity) untuk satu prompt, dipakai AI Visibility Tracker.
 *
 * API ini masih baru & bentuk responsnya bisa bergeser antar model, jadi
 * parsing dibuat SANGAT defensif: kumpulkan semua string teks + semua URL
 * dari struktur respons apa pun.
 */

export type AiPlatform = "chatgpt" | "gemini" | "claude" | "perplexity";

export const AI_PLATFORM_LABELS: Record<AiPlatform, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  claude: "Claude",
  perplexity: "Perplexity",
};

const PLATFORM_CONFIG: Record<
  AiPlatform,
  {
    endpoint: string;
    modelsEndpoint: string;
    preferredModels: string[];
  }
> = {
  chatgpt: {
    endpoint: "ai_optimization/chat_gpt/llm_responses/live",
    modelsEndpoint: "ai_optimization/chat_gpt/llm_responses/models",
    preferredModels: ["gpt-4o-mini"],
  },
  gemini: {
    endpoint: "ai_optimization/gemini/llm_responses/live",
    modelsEndpoint: "ai_optimization/gemini/llm_responses/models",
    preferredModels: ["gemini-2.5-flash-lite", "gemini-2.5-flash"],
  },
  claude: {
    endpoint: "ai_optimization/claude/llm_responses/live",
    modelsEndpoint: "ai_optimization/claude/llm_responses/models",
    preferredModels: ["claude-3-5-haiku-latest", "claude-sonnet-4-0"],
  },
  perplexity: {
    endpoint: "ai_optimization/perplexity/llm_responses/live",
    modelsEndpoint: "ai_optimization/perplexity/llm_responses/models",
    preferredModels: ["sonar"],
  },
};

export type LlmModelInfo = {
  model_name: string;
  reasoning?: boolean;
  web_search_supported?: boolean;
};

const MODEL_CACHE_TTL_MS = 60 * 60 * 1000;
const modelCache = new Map<
  AiPlatform,
  { expiresAt: number; promise: Promise<LlmModelInfo> }
>();

const CHEAP_MODEL_PATTERNS: Record<AiPlatform, RegExp[]> = {
  chatgpt: [/mini/i, /nano/i],
  gemini: [/flash-lite/i, /flash/i],
  claude: [/haiku/i, /sonnet/i],
  perplexity: [/sonar/i],
};

function fallbackModel(platform: AiPlatform): LlmModelInfo {
  return {
    model_name: PLATFORM_CONFIG[platform].preferredModels[0],
    web_search_supported: true,
  };
}

function isLlmModelInfo(value: unknown): value is LlmModelInfo {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { model_name?: unknown }).model_name === "string"
  );
}

/** Pilih model aktif yang murah dan tetap mendukung web search. */
export function selectLlmModel(
  platform: AiPlatform,
  models: LlmModelInfo[],
): LlmModelInfo {
  const config = PLATFORM_CONFIG[platform];
  const webModels = models.filter((model) => model.web_search_supported === true);

  for (const preferred of config.preferredModels) {
    const match = webModels.find((model) => model.model_name === preferred);
    if (match) return match;
  }

  for (const pattern of CHEAP_MODEL_PATTERNS[platform]) {
    const match = webModels.find((model) => pattern.test(model.model_name));
    if (match) return match;
  }

  if (webModels[0]) return webModels[0];

  for (const preferred of config.preferredModels) {
    const match = models.find((model) => model.model_name === preferred);
    if (match) return match;
  }

  return models[0] ?? fallbackModel(platform);
}

async function resolveLlmModel(platform: AiPlatform): Promise<LlmModelInfo> {
  const cached = modelCache.get(platform);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const config = PLATFORM_CONFIG[platform];
  const promise = (async () => {
    try {
      const response = await dataForSeoGet<LlmModelInfo>(config.modelsEndpoint, {
        maxRetries: 1,
      });
      const task = response.tasks?.[0];
      if (!task || task.status_code !== DFS_OK) {
        throw new DataForSeoError(
          task?.status_message ??
            `Daftar model ${AI_PLATFORM_LABELS[platform]} gagal dimuat.`,
          { statusCode: task?.status_code ?? null },
        );
      }

      const models = (task.result ?? []).filter(isLlmModelInfo);
      if (models.length === 0) {
        throw new DataForSeoError(
          `DataForSEO tidak mengembalikan model ${AI_PLATFORM_LABELS[platform]}.`,
        );
      }
      return selectLlmModel(platform, models);
    } catch (err) {
      console.warn(
        `[seo/ai-visibility] daftar model ${platform} gagal, memakai fallback`,
        err,
      );
      return fallbackModel(platform);
    }
  })();

  modelCache.set(platform, {
    expiresAt: Date.now() + MODEL_CACHE_TTL_MS,
    promise,
  });
  return promise;
}

export type LlmAnswer = {
  text: string;
  citations: string[];
};

export function buildLlmRequest(
  platform: AiPlatform,
  prompt: string,
  model: LlmModelInfo = fallbackModel(platform),
): { endpoint: string; payload: Record<string, unknown> } {
  return {
    endpoint: PLATFORM_CONFIG[platform].endpoint,
    payload: {
      user_prompt: prompt.slice(0, 500),
      model_name: model.model_name,
      web_search: model.web_search_supported === true,
    },
  };
}

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
  const model = await resolveLlmModel(platform);
  const { endpoint, payload } = buildLlmRequest(platform, prompt, model);

  const result = await withDataForSeoCache(endpoint, payload, async () => {
    return await dataForSeoLive<unknown>(endpoint, payload, {
      maxRetries: 1,
    });
  });

  return collectLlmAnswer(result);
}

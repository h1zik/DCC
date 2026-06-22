import { randomUUID } from "crypto";
import type Groq from "groq-sdk";
import type { ChatCompletion } from "groq-sdk/resources/chat/completions";

export type RecoveredToolCall = {
  name: string;
  args: Record<string, unknown>;
};

export function extractGroqFailedGeneration(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;

  const groqBody = err as {
    error?: {
      code?: string;
      failed_generation?: string;
      error?: { code?: string; failed_generation?: string };
    };
    status?: number;
  };

  const inner = groqBody.error?.error ?? groqBody.error;
  if (inner?.code !== "tool_use_failed") return null;
  return typeof inner.failed_generation === "string"
    ? inner.failed_generation
    : null;
}

export function isGroqToolUseFailed(err: unknown): boolean {
  return extractGroqFailedGeneration(err) != null;
}

/** Parse malformed tool output Groq returns in `failed_generation`. */
export function parseRecoveredToolCall(
  failedGeneration: string,
): RecoveredToolCall | null {
  const trimmed = failedGeneration.trim();

  const xmlMatch = trimmed.match(
    /<function=([a-zA-Z0-9_]+)\s*(\{[\s\S]*?\}|\([\s\S]*?\))\s*(?:<\/function>)?/,
  );
  if (xmlMatch) {
    const name = xmlMatch[1]!;
    let jsonPart = xmlMatch[2]!;
    if (jsonPart.startsWith("(") && jsonPart.endsWith(")")) {
      jsonPart = jsonPart.slice(1, -1);
    }
    try {
      const args = JSON.parse(jsonPart) as Record<string, unknown>;
      return { name, args };
    } catch {
      // fall through
    }
  }

  try {
    const obj = JSON.parse(trimmed) as {
      name?: string;
      arguments?: Record<string, unknown>;
    };
    if (obj.name && obj.arguments) {
      return { name: obj.name, args: obj.arguments };
    }
  } catch {
    // fall through
  }

  return null;
}

export function buildRecoveredCompletion(
  model: string,
  recovered: RecoveredToolCall,
): ChatCompletion {
  return {
    id: `recovered_${randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: `call_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
              type: "function",
              function: {
                name: recovered.name,
                arguments: JSON.stringify(recovered.args),
              },
            },
          ],
        },
        finish_reason: "tool_calls",
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}

type CreateParams = Parameters<Groq["chat"]["completions"]["create"]>[0];

export async function createGroqChatCompletion(
  groq: Groq,
  params: CreateParams,
  opts?: { recoveryAttempt?: number },
): Promise<ChatCompletion> {
  try {
    return (await groq.chat.completions.create({
      ...params,
      parallel_tool_calls: false,
    })) as ChatCompletion;
  } catch (err) {
    const failedGen = extractGroqFailedGeneration(err);
    const recovered = failedGen ? parseRecoveredToolCall(failedGen) : null;
    if (recovered) {
      console.warn(
        `[agent] Groq tool_use_failed — recovered tool: ${recovered.name}`,
      );
      return buildRecoveredCompletion(String(params.model), recovered);
    }

    const attempt = opts?.recoveryAttempt ?? 0;
    if (attempt < 1 && Array.isArray(params.messages)) {
      return createGroqChatCompletion(
        groq,
        {
          ...params,
          messages: [
            ...params.messages,
            {
              role: "user",
              content:
                "Panggil tool lewat function calling API (bukan teks/XML). Untuk queryId/reportId/analysisId gunakan field `id` dari hasil list_* — bukan nama keyword atau label tampilan.",
            },
          ],
        },
        { recoveryAttempt: attempt + 1 },
      );
    }

    throw err;
  }
}

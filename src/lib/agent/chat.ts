import {
  buildAgentSystemPrompt,
  isTransientLlmError,
  resolveAgentApiKey,
  resolveAgentModelCandidates,
  resolveAgentThink,
  withLlmRetry,
} from "./provider";
import { resolveOllamaBaseUrl } from "@/lib/research/llm/config";
import { parseToolArguments, toOllamaTools, type OllamaTool } from "./ollama-tools";
import { AGENT_TOOLS } from "./tools";
import { getAgentUserAccessSummary } from "./queries";
import { synthesizeAgentReply } from "./synthesize-reply";
import { executeAgentTool } from "./tools";
import { formatAgentAccessForPrompt } from "./user-access";
import type { AgentMessage, AgentUser } from "./types";

type ToolRun = {
  name: string;
  ok: boolean;
  data?: unknown;
  error?: string;
};

const MAX_TOOL_ROUNDS = 12;
const TEMPERATURE = 0.35;

export type AgentChatResult = {
  reply: string;
  toolCalls: { name: string; ok: boolean }[];
  modelUsed?: string;
};

/** Pesan format native Ollama /api/chat. */
export type OllamaChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
};

export type OllamaToolCall = {
  function: { name: string; arguments?: unknown };
};

type OllamaChatResponse = {
  message?: {
    role?: string;
    content?: string;
    tool_calls?: OllamaToolCall[];
  };
  error?: string;
};

let cachedTools: OllamaTool[] | null = null;
function agentTools(): OllamaTool[] {
  cachedTools ??= toOllamaTools(AGENT_TOOLS);
  return cachedTools;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toolResultContent(run: ToolRun): string {
  if (!run.ok) return JSON.stringify({ error: run.error ?? "Tool gagal." });
  return JSON.stringify(isPlainObject(run.data) ? run.data : { result: run.data ?? null });
}

async function ollamaAgentCall(
  apiKey: string,
  model: string,
  messages: OllamaChatMessage[],
  withTools: boolean,
): Promise<NonNullable<OllamaChatResponse["message"]>> {
  const res = await fetch(`${resolveOllamaBaseUrl()}/api/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      ...(withTools ? { tools: agentTools() } : {}),
      stream: false,
      think: resolveAgentThink(),
      options: { temperature: TEMPERATURE },
    }),
  });

  let payload: OllamaChatResponse;
  try {
    payload = (await res.json()) as OllamaChatResponse;
  } catch {
    payload = {};
  }

  if (!res.ok) {
    const err = new Error(
      `Ollama Cloud error ${res.status}: ${payload.error ?? res.statusText}`,
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return payload.message ?? {};
}

async function runAgentChatWithModel(
  user: AgentUser,
  messages: AgentMessage[],
  apiKey: string,
  modelName: string,
  accessContext: string,
): Promise<AgentChatResult> {
  const history: OllamaChatMessage[] = [
    { role: "system", content: buildAgentSystemPrompt(user, accessContext) },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Pesan user terakhir — dipakai server untuk memverifikasi konfirmasi
  // eksplisit pada aksi destruktif (bukan sekadar percaya confirmed:true).
  const latestUserMessage =
    [...messages].reverse().find((m) => m.role === "user")?.content ?? null;

  const toolCalls: { name: string; ok: boolean }[] = [];
  const toolRuns: ToolRun[] = [];

  let reply = await ollamaAgentCall(apiKey, modelName, history, true);
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    const calls = reply.tool_calls ?? [];
    if (calls.length === 0) break;

    // Echo balik giliran assistant (berisi tool_calls) ke histori.
    history.push({
      role: "assistant",
      content: reply.content ?? "",
      tool_calls: calls,
    });

    for (const call of calls) {
      const name = call.function?.name ?? "";
      const args = parseToolArguments(call.function?.arguments);
      const toolResult = await executeAgentTool(user, name, args, {
        latestUserMessage,
      });

      toolCalls.push({ name, ok: toolResult.ok });
      const run: ToolRun = {
        name,
        ok: toolResult.ok,
        data: toolResult.ok ? toolResult.data : undefined,
        error: toolResult.ok ? undefined : toolResult.error,
      };
      toolRuns.push(run);
      history.push({ role: "tool", tool_name: name, content: toolResultContent(run) });
    }

    reply = await withLlmRetry(() =>
      ollamaAgentCall(apiKey, modelName, history, true),
    );
    round += 1;
  }

  let text = reply.content?.trim() ?? "";

  if (!text && toolRuns.some((t) => t.ok)) {
    history.push({ role: "assistant", content: "" });
    history.push({
      role: "user",
      content:
        "Rangkum hasil tool di atas untuk user dalam Bahasa Indonesia: sertakan angka konkret, perbandingan, insight bisnis, dan rekomendasi jika relevan. Untuk data harga: sebutkan angka IDR per produk/kompetitor. Jangan bilang tidak ada data jika tool sudah mengembalikan harga. Jangan hanya bilang 'selesai'.",
    });

    try {
      const nudge = await withLlmRetry(() =>
        ollamaAgentCall(apiKey, modelName, history, false),
      );
      text = nudge.content?.trim() ?? "";
    } catch {
      // fallback ke synthesize di bawah
    }
  }

  if (!text && toolRuns.length > 0) {
    text = synthesizeAgentReply(toolRuns) ?? "";
  }

  return {
    reply:
      text ||
      "Maaf, saya gagal merangkum hasil. Coba ulangi pertanyaannya.",
    toolCalls,
    modelUsed: modelName,
  };
}

export const AGENT_API_KEY_MISSING_MESSAGE =
  "OLLAMA_API_KEY belum diset. Buat di https://ollama.com/settings/keys (model agent: kimi-k3.1-pro:cloud).";

export async function runAgentChat(
  user: AgentUser,
  messages: AgentMessage[],
): Promise<AgentChatResult> {
  const apiKey = resolveAgentApiKey();
  if (!apiKey) {
    throw new Error(AGENT_API_KEY_MISSING_MESSAGE);
  }

  const accessSummary = await getAgentUserAccessSummary(user);
  const accessContext = formatAgentAccessForPrompt(accessSummary);

  const candidates = resolveAgentModelCandidates();
  let lastError: unknown;

  for (const modelName of candidates) {
    try {
      return await withLlmRetry(
        () =>
          runAgentChatWithModel(
            user,
            messages,
            apiKey,
            modelName,
            accessContext,
          ),
        { maxRetries: 2, baseDelayMs: 600 },
      );
    } catch (err) {
      lastError = err;
      if (!isTransientLlmError(err)) throw err;
      console.warn(`[agent] Model ${modelName} sibuk, coba model berikutnya…`);
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : "layanan Ollama Cloud sibuk";
  throw new Error(
    `Model AI sedang sibuk. Coba lagi dalam 1–2 menit. (${detail})`,
  );
}

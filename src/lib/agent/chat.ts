import {
  GoogleGenerativeAI,
  type Content,
  type Part,
} from "@google/generative-ai";
import {
  buildAgentSystemPrompt,
  isTransientLlmError,
  resolveAgentApiKey,
  resolveAgentModelCandidates,
  withLlmRetry,
} from "./provider";
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

function toGeminiContents(messages: AgentMessage[]): Content[] {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** functionResponse.response harus berupa objek JSON. */
function toFunctionResponsePayload(run: {
  ok: boolean;
  data?: unknown;
  error?: string;
}): Record<string, unknown> {
  if (!run.ok) return { error: run.error ?? "Tool gagal." };
  if (isPlainObject(run.data)) return run.data;
  return { result: run.data ?? null };
}

/** Ambil teks dari response Gemini tanpa melempar saat hanya ada function call. */
function safeResponseText(response: {
  text: () => string;
}): string {
  try {
    return response.text()?.trim() ?? "";
  } catch {
    return "";
  }
}

async function runAgentChatWithModel(
  user: AgentUser,
  messages: AgentMessage[],
  apiKey: string,
  modelName: string,
  accessContext: string,
): Promise<AgentChatResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: buildAgentSystemPrompt(user, accessContext),
    tools: AGENT_TOOLS,
  });

  const contents: Content[] = toGeminiContents(messages);
  const generationConfig = { temperature: TEMPERATURE };

  const toolCalls: { name: string; ok: boolean }[] = [];
  const toolRuns: ToolRun[] = [];

  let result = await model.generateContent({ contents, generationConfig });
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    const calls = result.response.functionCalls() ?? [];
    if (calls.length === 0) break;

    // Echo balik giliran model (berisi function call) ke histori.
    const modelContent = result.response.candidates?.[0]?.content;
    if (modelContent) {
      contents.push(modelContent);
    }

    const responseParts: Part[] = [];
    for (const call of calls) {
      const args = isPlainObject(call.args) ? call.args : {};
      const toolResult = await executeAgentTool(user, call.name, args);

      toolCalls.push({ name: call.name, ok: toolResult.ok });
      const run: ToolRun = {
        name: call.name,
        ok: toolResult.ok,
        data: toolResult.ok ? toolResult.data : undefined,
        error: toolResult.ok ? undefined : toolResult.error,
      };
      toolRuns.push(run);

      responseParts.push({
        functionResponse: {
          name: call.name,
          response: toFunctionResponsePayload(run),
        },
      });
    }

    contents.push({ role: "user", parts: responseParts });

    result = await withLlmRetry(() =>
      model.generateContent({ contents, generationConfig }),
    );
    round += 1;
  }

  let text = safeResponseText(result.response);

  if (!text && toolRuns.some((t) => t.ok)) {
    const modelContent = result.response.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);
    contents.push({
      role: "user",
      parts: [
        {
          text: "Rangkum hasil tool di atas untuk user dalam Bahasa Indonesia: sertakan angka konkret, perbandingan, insight bisnis, dan rekomendasi jika relevan. Untuk data harga: sebutkan angka IDR per produk/kompetitor. Jangan bilang tidak ada data jika tool sudah mengembalikan harga. Jangan hanya bilang 'selesai'.",
        },
      ],
    });

    try {
      const nudge = await withLlmRetry(() =>
        model.generateContent({ contents, generationConfig }),
      );
      text = safeResponseText(nudge.response);
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

export async function runAgentChat(
  user: AgentUser,
  messages: AgentMessage[],
): Promise<AgentChatResult> {
  const apiKey = resolveAgentApiKey();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY belum diset. Dapatkan di https://aistudio.google.com/apikey",
    );
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
    lastError instanceof Error ? lastError.message : "layanan Gemini sibuk";
  throw new Error(
    `Semua model Gemini sedang sibuk. Coba lagi dalam 1–2 menit. (${detail})`,
  );
}

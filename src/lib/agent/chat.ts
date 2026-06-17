import type { Part } from "@google/generative-ai";
import {
  functionResponsePart,
  getAgentModel,
  historyToContents,
  isTransientGeminiError,
  resolveAgentApiKey,
  resolveAgentModelCandidates,
  withGeminiRetry,
} from "./provider";
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

export type AgentChatResult = {
  reply: string;
  toolCalls: { name: string; ok: boolean }[];
  modelUsed?: string;
};

async function runAgentChatWithModel(
  user: AgentUser,
  messages: AgentMessage[],
  apiKey: string,
  modelName: string,
  accessContext: string,
): Promise<AgentChatResult> {
  const model = getAgentModel({
    apiKey,
    model: modelName,
    user,
    accessContext,
  });
  const history = historyToContents(messages.slice(0, -1));
  const lastUser = messages[messages.length - 1];

  if (!lastUser || lastUser.role !== "user") {
    throw new Error("Pesan terakhir harus dari user.");
  }

  const chat = model.startChat({ history });
  const toolCalls: { name: string; ok: boolean }[] = [];
  const toolRuns: ToolRun[] = [];

  let response = await chat.sendMessage(lastUser.content);
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    const fnCalls = response.response.functionCalls();
    if (!fnCalls?.length) break;

    const responseParts: Part[] = [];

    for (const call of fnCalls) {
      const name = call.name;
      const args = (call.args ?? {}) as Record<string, unknown>;
      const result = await executeAgentTool(user, name, args);
      toolCalls.push({ name, ok: result.ok });
      toolRuns.push({
        name,
        ok: result.ok,
        data: result.ok ? result.data : undefined,
        error: result.ok ? undefined : result.error,
      });
      responseParts.push(
        functionResponsePart(
          name,
          result.ok ? result.data : { error: result.error },
        ),
      );
    }

    response = await withGeminiRetry(() => chat.sendMessage(responseParts));
    round += 1;
  }

  let text = response.response.text().trim();

  if (!text && toolRuns.some((t) => t.ok)) {
    try {
      const nudge = await withGeminiRetry(() =>
        chat.sendMessage(
          "Rangkum hasil tool di atas untuk user dalam Bahasa Indonesia: sertakan angka konkret, perbandingan, insight bisnis, dan rekomendasi jika relevan. Untuk data harga: sebutkan angka IDR per produk/kompetitor. Jangan bilang tidak ada data jika tool sudah mengembalikan harga. Jangan hanya bilang 'selesai'.",
        ),
      );
      text = nudge.response.text().trim();
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
      "GEMINI_API_KEY belum diset. Dapatkan gratis di https://aistudio.google.com/apikey",
    );
  }

  const accessSummary = await getAgentUserAccessSummary(user);
  const accessContext = formatAgentAccessForPrompt(accessSummary);

  const candidates = resolveAgentModelCandidates();
  let lastError: unknown;

  for (const modelName of candidates) {
    try {
      return await withGeminiRetry(
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
      if (!isTransientGeminiError(err)) throw err;
      console.warn(`[agent] Model ${modelName} sibuk, coba model berikutnya…`);
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : "layanan Gemini sibuk";
  throw new Error(
    `Semua model Gemini sedang sibuk. Coba lagi dalam 1–2 menit. (${detail})`,
  );
}

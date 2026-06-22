import Groq from "groq-sdk";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from "groq-sdk/resources/chat/completions";
import { createGroqChatCompletion } from "./groq-recovery";
import { GROQ_AGENT_TOOLS } from "./groq-tools";
import {
  buildAgentSystemPrompt,
  isTransientLlmError,
  resolveAgentApiKey,
  resolveAgentModelCandidates,
  withLlmRetry,
} from "./provider";
import { isGroqToolUseFailed } from "./groq-recovery";
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

function toGroqMessages(
  messages: AgentMessage[],
): ChatCompletionMessageParam[] {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content,
  }));
}

async function runAgentChatWithModel(
  user: AgentUser,
  messages: AgentMessage[],
  apiKey: string,
  modelName: string,
  accessContext: string,
): Promise<AgentChatResult> {
  const groq = new Groq({ apiKey });
  const systemPrompt = buildAgentSystemPrompt(user, accessContext);

  const chatMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...toGroqMessages(messages),
  ];

  const toolCalls: { name: string; ok: boolean }[] = [];
  const toolRuns: ToolRun[] = [];

  let response = await createGroqChatCompletion(groq, {
    model: modelName,
    messages: chatMessages,
    tools: GROQ_AGENT_TOOLS,
    tool_choice: "auto",
    temperature: 0.35,
  });

  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    const choice = response.choices[0];
    if (!choice) break;

    const assistantMessage = choice.message;
    const pendingToolCalls = assistantMessage.tool_calls;
    if (!pendingToolCalls?.length) break;

    chatMessages.push(
      assistantMessage as ChatCompletionAssistantMessageParam,
    );

    for (const call of pendingToolCalls) {
      if (call.type !== "function") continue;

      const name = call.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<
          string,
          unknown
        >;
      } catch {
        args = {};
      }

      const result = await executeAgentTool(user, name, args);
      toolCalls.push({ name, ok: result.ok });
      toolRuns.push({
        name,
        ok: result.ok,
        data: result.ok ? result.data : undefined,
        error: result.ok ? undefined : result.error,
      });

      const toolMessage: ChatCompletionToolMessageParam = {
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(
          result.ok ? result.data : { error: result.error },
        ),
      };
      chatMessages.push(toolMessage);
    }

    response = await withLlmRetry(() =>
      createGroqChatCompletion(groq, {
        model: modelName,
        messages: chatMessages,
        tools: GROQ_AGENT_TOOLS,
        tool_choice: "auto",
        temperature: 0.35,
      }),
    );
    round += 1;
  }

  let text = response.choices[0]?.message?.content?.trim() ?? "";

  if (!text && toolRuns.some((t) => t.ok)) {
    chatMessages.push({
      role: "user",
      content:
        "Rangkum hasil tool di atas untuk user dalam Bahasa Indonesia: sertakan angka konkret, perbandingan, insight bisnis, dan rekomendasi jika relevan. Untuk data harga: sebutkan angka IDR per produk/kompetitor. Jangan bilang tidak ada data jika tool sudah mengembalikan harga. Jangan hanya bilang 'selesai'.",
    });

    try {
      const nudge = await withLlmRetry(() =>
        groq.chat.completions.create({
          model: modelName,
          messages: chatMessages,
          temperature: 0.35,
        }),
      );
      text = nudge.choices[0]?.message?.content?.trim() ?? "";
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
      "GROQ_API_KEY belum diset. Dapatkan di https://console.groq.com/keys",
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
      if (!isTransientLlmError(err) && !isGroqToolUseFailed(err)) throw err;
      console.warn(`[agent] Model ${modelName} sibuk, coba model berikutnya…`);
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : "layanan Groq sibuk";
  throw new Error(
    `Semua model Groq sedang sibuk. Coba lagi dalam 1–2 menit. (${detail})`,
  );
}

import {
  GoogleGenerativeAI,
  type Content,
  type Part,
} from "@google/generative-ai";
import { AGENT_TOOLS } from "./tools";
import { buildAgentSystemInstruction } from "./user-context";
import type { AgentUser } from "./types";

export type AgentProviderConfig = {
  apiKey: string;
  model?: string;
  user?: AgentUser;
  accessContext?: string;
};

/** Model utama — Flash-Lite biasanya lebih stabil di tier gratis saat Flash penuh. */
const DEFAULT_MODEL = "gemini-2.5-flash-lite";

/** Cadangan otomatis jika model utama sibuk (503/429). */
const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
] as const;

const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

export function getAgentModel(config: AgentProviderConfig) {
  const genAI = new GoogleGenerativeAI(config.apiKey);
  return genAI.getGenerativeModel({
    model: config.model ?? DEFAULT_MODEL,
    systemInstruction: config.user
      ? buildAgentSystemInstruction(config.user, config.accessContext)
      : buildAgentSystemInstruction(
          {
            id: "unknown",
            name: null,
            email: null,
            role: "STUDIO",
          },
          config.accessContext,
        ),
    tools: AGENT_TOOLS,
  });
}

export function historyToContents(
  messages: { role: "user" | "assistant"; content: string }[],
): Content[] {
  // Gemini mensyaratkan history dimulai dari 'user' dan bergantian user/model.
  const sanitized: Content[] = [];

  for (const message of messages) {
    const role = message.role === "assistant" ? "model" : "user";
    const part = { text: message.content };

    if (sanitized.length === 0) {
      if (role === "model") continue;
      sanitized.push({ role, parts: [part] });
      continue;
    }

    const last = sanitized[sanitized.length - 1]!;
    if (last.role === role) {
      const lastPart = last.parts[last.parts.length - 1];
      if ("text" in lastPart && typeof lastPart.text === "string") {
        lastPart.text = `${lastPart.text}\n\n${message.content}`;
      } else {
        last.parts.push(part);
      }
      continue;
    }

    sanitized.push({ role, parts: [part] });
  }

  return sanitized;
}

export function functionResponsePart(name: string, result: unknown): Part {
  return {
    functionResponse: {
      name,
      response: { result },
    },
  };
}

export function resolveAgentApiKey(): string | null {
  const key =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    null;
  return key;
}

export function resolveAgentModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export function resolveAgentModelCandidates(): string[] {
  const primary = resolveAgentModel();
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const name of [primary, DEFAULT_MODEL, ...FALLBACK_MODELS]) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    candidates.push(name);
  }

  return candidates;
}

function geminiErrorStatus(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

export function isTransientGeminiError(err: unknown): boolean {
  const status = geminiErrorStatus(err);
  if (status != null && TRANSIENT_STATUS.has(status)) return true;

  const message =
    err instanceof Error
      ? err.message.toLowerCase()
      : String(err).toLowerCase();

  return (
    message.includes("high demand") ||
    message.includes("overloaded") ||
    message.includes("service unavailable") ||
    message.includes("try again") ||
    message.includes("rate limit") ||
    message.includes("resource exhausted") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("socket hang up")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; baseDelayMs?: number },
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? 3;
  const baseDelayMs = opts?.baseDelayMs ?? 800;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransientGeminiError(err) || attempt >= maxRetries) break;
      const delay = baseDelayMs * 2 ** attempt;
      console.warn(
        `[agent] Gemini sibuk, retry ${attempt + 1}/${maxRetries} dalam ${delay}ms…`,
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

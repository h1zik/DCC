import { buildAgentSystemInstruction } from "./user-context";
import type { AgentUser } from "./types";

export type AgentProviderConfig = {
  apiKey: string;
  model?: string;
  user?: AgentUser;
  accessContext?: string;
};

/** Model utama agent — Gemini murah dengan dukungan function calling. */
const DEFAULT_MODEL = "gemini-2.5-flash-lite";

/** Cadangan jika model utama sibuk / rate limit. */
const FALLBACK_MODELS = ["gemini-2.0-flash-lite", "gemini-2.5-flash"] as const;

const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

export function buildAgentSystemPrompt(
  user: AgentUser,
  accessContext?: string,
): string {
  return buildAgentSystemInstruction(user, accessContext);
}

export function resolveAgentApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    null
  );
}

export function resolveAgentModel(): string {
  return (
    process.env.AGENT_LLM_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_MODEL
  );
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

function llmErrorStatus(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

export function isTransientLlmError(err: unknown): boolean {
  const status = llmErrorStatus(err);
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

/** @deprecated Gunakan isTransientLlmError */
export const isTransientGeminiError = isTransientLlmError;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withLlmRetry<T>(
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
      if (!isTransientLlmError(err) || attempt >= maxRetries) break;
      const delay = baseDelayMs * 2 ** attempt;
      console.warn(
        `[agent] LLM sibuk, retry ${attempt + 1}/${maxRetries} dalam ${delay}ms…`,
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

/** @deprecated Gunakan withLlmRetry */
export const withGeminiRetry = withLlmRetry;

import "server-only";

import { isGeminiResponseBlockedError } from "./gemini-blocked-error";

const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

function errorStatus(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

export function isTransientLlmError(err: unknown): boolean {
  if (isGeminiResponseBlockedError(err)) return false;

  const status = errorStatus(err);
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
    message.includes("socket hang up") ||
    message.includes("too many requests")
  );
}

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
        `[research/llm] provider sibuk, retry ${attempt + 1}/${maxRetries} dalam ${delay}ms…`,
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

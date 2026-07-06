import {
  aiRoleLabel,
  isAiApiAuthorized,
  resolveAiApiRole,
  type AiApiRole,
} from "./auth";
import { checkAiApiRateLimit } from "./rate-limit";
import { aiApiError } from "./response";

export type AiApiContext = {
  role: AiApiRole;
};

function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

export function guardAiApiRequest(req: Request):
  | { ok: true; ctx: AiApiContext }
  | { ok: false; response: Response } {
  if (!process.env.AI_READ_API_TOKEN?.trim()) {
    return {
      ok: false,
      response: aiApiError(
        "AI_READ_API_TOKEN belum diset di environment Railway.",
        503,
      ),
    };
  }

  if (!isAiApiAuthorized(req)) {
    return {
      ok: false,
      response: aiApiError("Unauthorized", 401),
    };
  }

  const rate = checkAiApiRateLimit(clientKey(req));
  if (!rate.allowed) {
    return {
      ok: false,
      response: aiApiError("Rate limit exceeded", 429, {
        retryAfterSec: rate.retryAfterSec,
      }),
    };
  }

  const role = resolveAiApiRole(req);
  if (!role) {
    return {
      ok: false,
      response: aiApiError(
        "AI_READ_API_ROLE belum diset (atau nilainya tidak valid) di environment. " +
          "Set salah satu dari: CEO, ADMINISTRATOR, LOGISTICS, FINANCE, STUDIO, ALL — " +
          "sesuai cakupan data yang boleh dibaca integrasi ini.",
        503,
      ),
    };
  }
  console.info(
    `[ai-api] ${req.method} ${new URL(req.url).pathname} role=${aiRoleLabel(role)}`,
  );

  return { ok: true, ctx: { role } };
}

export function parseLimitParam(
  raw: string | null,
  fallback = 20,
  max = 50,
): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

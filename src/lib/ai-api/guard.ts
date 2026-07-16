import {
  aiRoleLabel,
  hasAiApiCredentialConfig,
  isAiApiPathAllowed,
  resolveAiApiCredential,
  type AiApiRole,
  type AiApiScope,
} from "./auth";
import { checkAiApiRateLimit } from "./rate-limit";
import { aiApiError } from "./response";

export type AiApiContext = {
  role: AiApiRole;
  scope: AiApiScope;
  keyId: "primary" | "research-team";
};

function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

export function guardAiApiRequest(req: Request):
  | { ok: true; ctx: AiApiContext }
  | { ok: false; response: Response } {
  if (!hasAiApiCredentialConfig()) {
    return {
      ok: false,
      response: aiApiError(
        "AI_READ_API_TOKEN atau AI_RESEARCH_API_TOKEN belum diset di environment Railway.",
        503,
      ),
    };
  }

  const credential = resolveAiApiCredential(req);
  if (!credential) {
    return {
      ok: false,
      response: aiApiError("Unauthorized", 401),
    };
  }

  const pathname = new URL(req.url).pathname;
  if (!isAiApiPathAllowed(credential.scope, pathname)) {
    return {
      ok: false,
      response: aiApiError("Forbidden: token tidak memiliki scope endpoint ini.", 403),
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

  const role = credential.role;
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
    `[ai-api] ${req.method} ${pathname} key=${credential.keyId} scope=${credential.scope} role=${aiRoleLabel(role)}`,
  );

  return {
    ok: true,
    ctx: { role, scope: credential.scope, keyId: credential.keyId },
  };
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

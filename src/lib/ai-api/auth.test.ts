import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isAiApiPathAllowed,
  resolveAiApiCredential,
  resolveAiApiRole,
} from "./auth";
import { guardAiApiRequest } from "./guard";

/**
 * Regression test H-09: role API AI tidak boleh default diam-diam ke "CEO"
 * saat AI_READ_API_ROLE kosong/invalid — harus fail-closed (null → guard 503).
 */

const ENV_KEYS = [
  "AI_READ_API_ROLE",
  "AI_READ_API_ALLOW_ROLE_HEADER",
  "AI_READ_API_TOKEN",
  "AI_RESEARCH_API_TOKEN",
] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/ai/finance/summary", { headers });
}

describe("resolveAiApiRole", () => {
  it("null (bukan CEO) bila AI_READ_API_ROLE tidak diset", () => {
    expect(resolveAiApiRole(req())).toBeNull();
  });

  it("null bila nilainya invalid", () => {
    process.env.AI_READ_API_ROLE = "SUPERADMIN";
    expect(resolveAiApiRole(req())).toBeNull();
  });

  it("membaca role valid (trim + uppercase)", () => {
    process.env.AI_READ_API_ROLE = " finance ";
    expect(resolveAiApiRole(req())).toBe("FINANCE");
  });

  it("header x-dcc-role DIABAIKAN tanpa flag eksplisit", () => {
    process.env.AI_READ_API_ROLE = "STUDIO";
    expect(resolveAiApiRole(req({ "x-dcc-role": "ALL" }))).toBe("STUDIO");
  });

  it("header dihormati hanya saat AI_READ_API_ALLOW_ROLE_HEADER=true", () => {
    process.env.AI_READ_API_ROLE = "STUDIO";
    process.env.AI_READ_API_ALLOW_ROLE_HEADER = "true";
    expect(resolveAiApiRole(req({ "x-dcc-role": "FINANCE" }))).toBe("FINANCE");
  });
});

describe("Research Team API credential", () => {
  it("mengikat token Research ke role dan scope paling sempit", () => {
    process.env.AI_RESEARCH_API_TOKEN = "research-secret";
    process.env.AI_READ_API_ROLE = "CEO";

    const credential = resolveAiApiCredential(
      req({ authorization: "Bearer research-secret", "x-dcc-role": "ALL" }),
    );

    expect(credential).toEqual({
      keyId: "research-team",
      role: "MARKET_ANALYST",
      scope: "research",
    });
  });

  it("hanya mengizinkan namespace /api/ai/research", () => {
    expect(isAiApiPathAllowed("research", "/api/ai/research/dashboard")).toBe(
      true,
    );
    expect(isAiApiPathAllowed("research", "/api/ai/researchish")).toBe(false);
    expect(isAiApiPathAllowed("research", "/api/ai/finance/summary")).toBe(
      false,
    );
  });

  it("memilih scope Research bila kedua token tidak sengaja sama", () => {
    process.env.AI_RESEARCH_API_TOKEN = "same-secret";
    process.env.AI_READ_API_TOKEN = "same-secret";
    process.env.AI_READ_API_ROLE = "CEO";

    expect(
      resolveAiApiCredential(
        req({ authorization: "Bearer same-secret" }),
      )?.scope,
    ).toBe("research");
  });

  it("guard menerima route Research tetapi menolak route sensitif", () => {
    process.env.AI_RESEARCH_API_TOKEN = "research-secret";
    const headers = { authorization: "Bearer research-secret" };

    const allowed = guardAiApiRequest(
      new Request("http://localhost/api/ai/research/dashboard", { headers }),
    );
    expect(allowed.ok).toBe(true);
    if (allowed.ok) {
      expect(allowed.ctx).toMatchObject({
        keyId: "research-team",
        role: "MARKET_ANALYST",
        scope: "research",
      });
    }

    const denied = guardAiApiRequest(
      new Request("http://localhost/api/ai/finance/summary", { headers }),
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.response.status).toBe(403);
  });
});

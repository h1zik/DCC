import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveAiApiRole } from "./auth";

/**
 * Regression test H-09: role API AI tidak boleh default diam-diam ke "CEO"
 * saat AI_READ_API_ROLE kosong/invalid — harus fail-closed (null → guard 503).
 */

const ENV_KEYS = ["AI_READ_API_ROLE", "AI_READ_API_ALLOW_ROLE_HEADER"] as const;
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

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApifyRunNotFoundError,
  getApifyRunStatus,
  normalizeApifyActorId,
} from "@/lib/apify/client";

const originalFetch = globalThis.fetch;
const originalToken = process.env.APIFY_API_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.APIFY_API_TOKEN = originalToken;
  vi.restoreAllMocks();
});

function mockFetch(status: number, body: unknown = {}) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as typeof fetch;
}

describe("normalizeApifyActorId", () => {
  it("accepts both slash and tilde separators", () => {
    expect(normalizeApifyActorId("gio21/shopee-scraper")).toBe("gio21~shopee-scraper");
    expect(normalizeApifyActorId(" clockworks~tiktok-scraper ")).toBe(
      "clockworks~tiktok-scraper",
    );
  });
});

describe("getApifyRunStatus", () => {
  it("returns status and dataset id on success", async () => {
    process.env.APIFY_API_TOKEN = "token";
    mockFetch(200, {
      data: { id: "run1", status: "SUCCEEDED", defaultDatasetId: "ds1" },
    });

    await expect(getApifyRunStatus("run1")).resolves.toEqual({
      status: "SUCCEEDED",
      datasetId: "ds1",
    });
  });

  it("throws a distinguishable error when the run no longer exists", async () => {
    // Ini kondisi terminal: run yang hilang tidak akan pernah kembali, jadi
    // pemanggil harus bisa membedakannya dari gangguan jaringan sesaat.
    process.env.APIFY_API_TOKEN = "token";
    mockFetch(404);

    await expect(getApifyRunStatus("gone")).rejects.toBeInstanceOf(
      ApifyRunNotFoundError,
    );
  });

  it("treats 410 Gone the same way", async () => {
    process.env.APIFY_API_TOKEN = "token";
    mockFetch(410);

    await expect(getApifyRunStatus("gone")).rejects.toBeInstanceOf(
      ApifyRunNotFoundError,
    );
  });

  it("keeps transient failures as ordinary errors so callers can retry", async () => {
    process.env.APIFY_API_TOKEN = "token";
    mockFetch(503);

    const err = await getApifyRunStatus("run1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ApifyRunNotFoundError);
  });
});

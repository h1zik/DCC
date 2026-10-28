import { describe, expect, it } from "vitest";
import { SeoAnalysisStatus } from "@prisma/client";
import { SEO_STALE_RUN_MS, isSeoRunStale } from "./labels";

describe("isSeoRunStale", () => {
  const now = Date.parse("2026-10-28T05:00:00Z");

  it("busy & lebih tua dari ambang → stale", () => {
    const old = new Date(now - SEO_STALE_RUN_MS - 1000);
    expect(isSeoRunStale(SeoAnalysisStatus.COLLECTING, old, now)).toBe(true);
    expect(isSeoRunStale(SeoAnalysisStatus.PENDING, old.toISOString(), now)).toBe(true);
    expect(isSeoRunStale(SeoAnalysisStatus.ANALYZING, old, now)).toBe(true);
  });

  it("busy tapi masih segar → tidak stale", () => {
    const recent = new Date(now - 60_000);
    expect(isSeoRunStale(SeoAnalysisStatus.COLLECTING, recent, now)).toBe(false);
  });

  it("status final tidak pernah stale", () => {
    const old = new Date(now - 10 * SEO_STALE_RUN_MS);
    expect(isSeoRunStale(SeoAnalysisStatus.READY, old, now)).toBe(false);
    expect(isSeoRunStale(SeoAnalysisStatus.FAILED, old, now)).toBe(false);
  });

  it("tanggal tidak valid → tidak stale (fail-safe)", () => {
    expect(isSeoRunStale(SeoAnalysisStatus.COLLECTING, "bukan tanggal", now)).toBe(false);
  });
});

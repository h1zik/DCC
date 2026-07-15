import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/seo/dataforseo/usage", () => ({
  recordDataForSeoUsage: vi.fn(),
}));

import { normalizeCompetition } from "./client";

describe("normalizeCompetition", () => {
  it("keeps DataForSEO keyword competition on its existing 0–1 scale", () => {
    expect(normalizeCompetition(0)).toBe(0);
    expect(normalizeCompetition(0.42)).toBe(0.42);
    expect(normalizeCompetition(0.95)).toBe(0.95);
    expect(normalizeCompetition(1)).toBe(1);
  });

  it("rejects missing or invalid values and clamps out-of-range ratios", () => {
    expect(normalizeCompetition(null)).toBeNull();
    expect(normalizeCompetition(undefined)).toBeNull();
    expect(normalizeCompetition(Number.NaN)).toBeNull();
    expect(normalizeCompetition(-0.1)).toBe(0);
    expect(normalizeCompetition(1.1)).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import {
  computeDaysRunning,
  scoreAdWinning,
  type AdWinningSignals,
} from "@/lib/brand-research/ad-winning-score";

function sig(overrides: Partial<AdWinningSignals> = {}): AdWinningSignals {
  return {
    daysRunning: 10,
    isActive: true,
    collationCount: 2,
    audienceUpper: null,
    platformCount: 2,
    ...overrides,
  };
}

describe("computeDaysRunning", () => {
  const now = new Date("2026-03-01T00:00:00Z");
  it("uses stop date when present", () => {
    expect(
      computeDaysRunning(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-11T00:00:00Z"), now),
    ).toBe(10);
  });
  it("uses now when still active (no stop)", () => {
    expect(computeDaysRunning(new Date("2026-02-01T00:00:00Z"), null, now)).toBe(28);
  });
  it("returns null without a start date", () => {
    expect(computeDaysRunning(null, null, now)).toBeNull();
  });
});

describe("scoreAdWinning", () => {
  it("scores a long-running, multi-variant active ad as winning", () => {
    const r = scoreAdWinning(sig({ daysRunning: 60, collationCount: 12, isActive: true }));
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.tier).toBe("hot");
  });

  it("scores a brand-new single ad low (testing/new)", () => {
    const r = scoreAdWinning(sig({ daysRunning: 0, collationCount: 1, isActive: true }));
    expect(r.score).toBeLessThan(45);
    expect(["new", "testing"]).toContain(r.tier);
  });

  it("ranks longer-running ad above a fresh one", () => {
    const long = scoreAdWinning(sig({ daysRunning: 50 }));
    const fresh = scoreAdWinning(sig({ daysRunning: 2 }));
    expect(long.score).toBeGreaterThan(fresh.score);
  });

  it("does not penalize ads with no reach data (commercial ads)", () => {
    const withReach = scoreAdWinning(sig({ daysRunning: 30, audienceUpper: 500000 }));
    const noReach = scoreAdWinning(sig({ daysRunning: 30, audienceUpper: null }));
    // No-reach gets a neutral baseline, so it stays close (within ~12 pts).
    expect(Math.abs(withReach.score - noReach.score)).toBeLessThanOrEqual(12);
  });

  it("inactive ad scores below an otherwise-identical active ad", () => {
    const active = scoreAdWinning(sig({ isActive: true }));
    const inactive = scoreAdWinning(sig({ isActive: false }));
    expect(active.score).toBeGreaterThan(inactive.score);
  });
});

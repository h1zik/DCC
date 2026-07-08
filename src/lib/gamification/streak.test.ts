import { describe, expect, it } from "vitest";
import {
  bridgesOnlyWeekend,
  computeHistoricalStreak,
  nextStreak,
  streakMultiplier,
} from "./streak";

describe("streak continuation", () => {
  it("starts at 1 when there is no prior check-in", () => {
    expect(nextStreak(0, null, "2026-07-08")).toBe(1);
  });

  it("does not double-count the same day", () => {
    expect(nextStreak(5, "2026-07-08", "2026-07-08")).toBe(5);
  });

  it("increments on the next calendar day", () => {
    // 2026-07-08 Wed → 2026-07-09 Thu
    expect(nextStreak(5, "2026-07-08", "2026-07-09")).toBe(6);
  });

  it("bridges a weekend (Fri → Mon keeps the streak)", () => {
    // 2026-07-10 Fri → 2026-07-13 Mon
    expect(bridgesOnlyWeekend("2026-07-10", "2026-07-13")).toBe(true);
    expect(nextStreak(9, "2026-07-10", "2026-07-13")).toBe(10);
  });

  it("resets when a workday is missed (Mon → Wed)", () => {
    // 2026-07-13 Mon → 2026-07-15 Wed (Tue missed)
    expect(bridgesOnlyWeekend("2026-07-13", "2026-07-15")).toBe(false);
    expect(nextStreak(9, "2026-07-13", "2026-07-15")).toBe(1);
  });

  it("ignores out-of-order (earlier) dates", () => {
    expect(nextStreak(5, "2026-07-08", "2026-07-07")).toBe(5);
  });
});

describe("streak multiplier (tiered + capped)", () => {
  it("applies the tier schedule", () => {
    expect(streakMultiplier(1)).toBe(1.0);
    expect(streakMultiplier(2)).toBe(1.0);
    expect(streakMultiplier(3)).toBe(1.25);
    expect(streakMultiplier(6)).toBe(1.25);
    expect(streakMultiplier(7)).toBe(1.5);
    expect(streakMultiplier(13)).toBe(1.5);
    expect(streakMultiplier(14)).toBe(2.0);
  });

  it("never exceeds the cap", () => {
    expect(streakMultiplier(9999)).toBe(2.0);
  });
});

describe("computeHistoricalStreak (backfill)", () => {
  it("finds the longest run and the current tail across gaps", () => {
    // Run 1: Mon–Fri + bridge to Mon = 6 days; gap; run 2: 2 days.
    const dates = [
      "2026-07-06", // Mon
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10", // Fri
      "2026-07-13", // Mon (weekend bridged → 6)
      "2026-07-16", // Thu — gap (Tue/Wed missed) → reset
      "2026-07-17", // Fri → 2
    ];
    const r = computeHistoricalStreak(dates);
    expect(r.longest).toBe(6);
    expect(r.current).toBe(2);
  });

  it("is empty-safe", () => {
    expect(computeHistoricalStreak([])).toEqual({ current: 0, longest: 0 });
  });
});

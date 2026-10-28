import { describe, expect, it } from "vitest";
import {
  buildWeeklySummary,
  computeWeeklyStats,
} from "@/lib/seo/rank-tracker/weekly-summary";

describe("buildWeeklySummary", () => {
  it("includes visibility delta, movers, and top10 changes", () => {
    const msg = buildWeeklySummary({
      projectName: "Brand A",
      visibilityNow: 12.5,
      visibilityLastWeek: 10,
      keywords: [
        { keyword: "serum niacinamide", previousPosition: 15, currentPosition: 6 },
        { keyword: "toner exfoliating", previousPosition: 5, currentPosition: 12 },
      ],
      enteredTop10: 1,
      droppedFromTop10: 1,
    });
    expect(msg).toContain("Brand A");
    expect(msg).toContain("12.5%");
    expect(msg).toContain("naik 2.5 poin");
    expect(msg).toContain('"serum niacinamide" (+9)');
    expect(msg).toContain('"toner exfoliating" (-7)');
    expect(msg).toContain("1 keyword masuk top 10");
    expect(msg).not.toContain("keyword baru");
  });

  it("handles first week (no history)", () => {
    const msg = buildWeeklySummary({
      projectName: "Brand A",
      visibilityNow: 5,
      visibilityLastWeek: null,
      keywords: [],
      enteredTop10: 0,
      droppedFromTop10: 0,
    });
    expect(msg).toContain("Visibility 5%");
    expect(msg).not.toContain("poin");
  });

  it("reports new keywords separately", () => {
    const msg = buildWeeklySummary({
      projectName: "Brand A",
      visibilityNow: 5,
      visibilityLastWeek: 5,
      keywords: [],
      enteredTop10: 0,
      droppedFromTop10: 0,
      newKeywords: 3,
    });
    expect(msg).toContain("3 keyword baru belum punya data seminggu");
  });
});

describe("computeWeeklyStats", () => {
  it("excludes keywords without a week-old snapshot from movers, top10 and both visibilities", () => {
    const stats = computeWeeklyStats([
      // Punya riwayat: naik ke top 10.
      { keyword: "lama", lastPosition: 4, searchVolume: 1000, weekAgoPosition: 15 },
      // Punya riwayat, dulu di luar top 100 (null) — tetap ikut sebagai "entered".
      { keyword: "masuk", lastPosition: 30, searchVolume: 1000, weekAgoPosition: null },
      // Keyword baru ranking #1 — tidak boleh jadi mover/top10/melonjakkan visibility.
      { keyword: "baru", lastPosition: 1, searchVolume: 100000, weekAgoPosition: undefined },
    ]);
    expect(stats.newKeywords).toBe(1);
    expect(stats.keywords.map((k) => k.keyword)).toEqual(["lama", "masuk"]);
    expect(stats.enteredTop10).toBe(1);
    expect(stats.droppedFromTop10).toBe(0);
    // Subset sama → visibility sekarang dihitung tanpa "baru".
    expect(stats.visibilityNow).toBeLessThan(50);
    expect(stats.visibilityLastWeek).not.toBeNull();
    expect(stats.visibilityNow).toBeGreaterThan(stats.visibilityLastWeek!);
  });

  it("falls back to all keywords with no comparison when nothing has history", () => {
    const stats = computeWeeklyStats([
      { keyword: "a", lastPosition: 1, searchVolume: 10, weekAgoPosition: undefined },
      { keyword: "b", lastPosition: null, searchVolume: 10, weekAgoPosition: undefined },
    ]);
    expect(stats.newKeywords).toBe(2);
    expect(stats.visibilityNow).toBe(50);
    expect(stats.visibilityLastWeek).toBeNull();
    expect(stats.keywords).toEqual([]);
    expect(stats.enteredTop10).toBe(0);
  });
});

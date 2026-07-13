import { describe, expect, it } from "vitest";
import { buildWeeklySummary } from "@/lib/seo/rank-tracker/weekly-summary";

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
});

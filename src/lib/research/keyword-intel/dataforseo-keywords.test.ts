import { describe, expect, it } from "vitest";
import { inferTrendFromDfsMonthlySearches } from "@/lib/research/keyword-intel/dataforseo-keywords";

describe("inferTrendFromDfsMonthlySearches", () => {
  it("detects upward volume from monthly searches", () => {
    const monthly = [
      { year: 2025, month: 1, search_volume: 100 },
      { year: 2025, month: 2, search_volume: 110 },
      { year: 2025, month: 3, search_volume: 120 },
      { year: 2025, month: 4, search_volume: 130 },
      { year: 2025, month: 5, search_volume: 400 },
      { year: 2025, month: 6, search_volume: 450 },
    ];
    expect(inferTrendFromDfsMonthlySearches(monthly)).toBe("up");
  });

  it("returns null when fewer than 4 months", () => {
    expect(
      inferTrendFromDfsMonthlySearches([
        { year: 2025, month: 1, search_volume: 100 },
      ]),
    ).toBeNull();
  });
});

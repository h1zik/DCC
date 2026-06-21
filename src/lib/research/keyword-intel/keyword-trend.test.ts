import { describe, expect, it } from "vitest";
import {
  inferTrendFromTimelineValues,
  mergeKeywordTrend,
} from "@/lib/research/keyword-intel/keyword-trend";

describe("inferTrendFromTimelineValues", () => {
  it("detects upward momentum from full timeline", () => {
    const values = [10, 12, 14, 16, 40, 45, 50, 55];
    expect(inferTrendFromTimelineValues(values)).toBe("up");
  });

  it("detects downward momentum", () => {
    const values = [50, 48, 45, 42, 20, 18, 15, 12];
    expect(inferTrendFromTimelineValues(values)).toBe("down");
  });

  it("returns stable when data is sparse", () => {
    expect(inferTrendFromTimelineValues([10, 12])).toBe("stable");
  });
});

describe("mergeKeywordTrend", () => {
  it("prefers up/down over stable", () => {
    expect(mergeKeywordTrend("stable", "up")).toBe("up");
    expect(mergeKeywordTrend("up", "stable")).toBe("up");
  });
});

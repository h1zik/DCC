import { describe, expect, it } from "vitest";
import { getTodayDateString } from "./attendance";

describe("getTodayDateString", () => {
  it("uses the Asia/Jakarta calendar date", () => {
    expect(getTodayDateString(new Date("2026-07-17T16:59:59Z"))).toBe(
      "2026-07-17",
    );
    expect(getTodayDateString(new Date("2026-07-17T17:00:00Z"))).toBe(
      "2026-07-18",
    );
  });
});

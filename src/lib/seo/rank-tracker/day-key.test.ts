import { describe, expect, it } from "vitest";
import {
  isSameWibDay,
  startOfWibDay,
  wibDayKey,
  wibDayKeyRange,
} from "@/lib/seo/rank-tracker/day-key";

describe("wibDayKey", () => {
  it("rolls to the next day at 17:00 UTC (00:00 WIB)", () => {
    expect(wibDayKey(new Date("2026-10-27T16:59:59.000Z"))).toBe("2026-10-27");
    expect(wibDayKey(new Date("2026-10-27T17:00:00.000Z"))).toBe("2026-10-28");
  });

  it("differs from the UTC day for early-morning WIB checks", () => {
    // 05:02 WIB = 22:02 UTC hari sebelumnya.
    const d = new Date("2026-10-27T22:02:00.000Z");
    expect(d.toISOString().slice(0, 10)).toBe("2026-10-27");
    expect(wibDayKey(d)).toBe("2026-10-28");
  });

  it("accepts ISO strings and epoch millis", () => {
    expect(wibDayKey("2026-01-01T00:00:00.000Z")).toBe("2026-01-01");
    expect(wibDayKey(Date.UTC(2025, 11, 31, 20, 0, 0))).toBe("2026-01-01");
  });
});

describe("startOfWibDay", () => {
  it("returns 17:00 UTC of the previous UTC day", () => {
    const start = startOfWibDay(new Date("2026-10-28T03:30:00.000Z"));
    expect(start.toISOString()).toBe("2026-10-27T17:00:00.000Z");
    expect(wibDayKey(start)).toBe("2026-10-28");
  });

  it("is idempotent", () => {
    const start = startOfWibDay(new Date("2026-10-28T16:59:00.000Z"));
    expect(startOfWibDay(start).getTime()).toBe(start.getTime());
  });
});

describe("isSameWibDay / wibDayKeyRange", () => {
  it("compares by WIB calendar day", () => {
    expect(
      isSameWibDay("2026-10-27T17:00:00.000Z", "2026-10-28T16:59:59.000Z"),
    ).toBe(true);
    expect(
      isSameWibDay("2026-10-27T16:59:59.000Z", "2026-10-27T17:00:00.000Z"),
    ).toBe(false);
  });

  it("builds an ascending range ending today", () => {
    const now = new Date("2026-10-28T01:00:00.000Z");
    expect(wibDayKeyRange(3, now)).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
    ]);
  });
});

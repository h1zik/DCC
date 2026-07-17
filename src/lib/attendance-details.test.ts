import { describe, expect, it } from "vitest";
import {
  MAX_ATTENDANCE_DETAIL_ITEMS,
  MAX_ATTENDANCE_DETAIL_LENGTH,
  normalizeAttendanceDetails,
} from "./attendance-details";

describe("normalizeAttendanceDetails", () => {
  it("trims entries and removes empty values", () => {
    expect(normalizeAttendanceDetails(["  Riset kompetitor ", "", "  "])).toEqual(
      { ok: true, items: ["Riset kompetitor"] },
    );
  });

  it("allows an empty list to clear a detail", () => {
    expect(normalizeAttendanceDetails([])).toEqual({ ok: true, items: [] });
  });

  it("rejects invalid or oversized entries", () => {
    expect(normalizeAttendanceDetails("bukan daftar").ok).toBe(false);
    expect(
      normalizeAttendanceDetails(
        Array.from({ length: MAX_ATTENDANCE_DETAIL_ITEMS + 1 }, () => "item"),
      ).ok,
    ).toBe(false);
    expect(
      normalizeAttendanceDetails(["x".repeat(MAX_ATTENDANCE_DETAIL_LENGTH + 1)])
        .ok,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { isOnTimeCheckIn, isoWeekKey, jakartaClock, jakartaHour } from "./time";

// Asia/Jakarta = UTC+7 (tanpa DST).
describe("jakarta time helpers", () => {
  it("converts UTC to Jakarta wall-clock", () => {
    // 01:30Z → 08:30 WIB
    expect(jakartaClock(new Date("2026-07-08T01:30:00Z"))).toBe("08:30");
    // 02:30Z → 09:30 WIB
    expect(jakartaClock(new Date("2026-07-08T02:30:00Z"))).toBe("09:30");
    // 23:00Z → 06:00 WIB keesokan hari
    expect(jakartaClock(new Date("2026-07-07T23:00:00Z"))).toBe("06:00");
  });

  it("jakartaHour returns the local hour", () => {
    expect(jakartaHour(new Date("2026-07-07T23:30:00Z"))).toBe(6);
    expect(jakartaHour(new Date("2026-07-08T05:00:00Z"))).toBe(12);
  });

  it("isOnTimeCheckIn honors the cutoff", () => {
    const cutoff = "09:15";
    // 08:30 WIB → on-time
    expect(isOnTimeCheckIn(new Date("2026-07-08T01:30:00Z"), cutoff)).toBe(true);
    // 09:15 WIB exactly → on-time (inclusive)
    expect(isOnTimeCheckIn(new Date("2026-07-08T02:15:00Z"), cutoff)).toBe(true);
    // 09:30 WIB → late
    expect(isOnTimeCheckIn(new Date("2026-07-08T02:30:00Z"), cutoff)).toBe(false);
  });

  it("isoWeekKey is stable and ISO-8601 correct", () => {
    // 2026-01-01 is a Thursday → ISO week 2026-W01
    expect(isoWeekKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-W01");
    // Days in the same ISO week share the key
    expect(isoWeekKey(new Date("2026-07-06T00:00:00Z"))).toBe(
      isoWeekKey(new Date("2026-07-10T00:00:00Z")),
    );
  });
});

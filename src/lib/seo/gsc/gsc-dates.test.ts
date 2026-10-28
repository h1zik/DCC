import { describe, expect, it } from "vitest";
import {
  GSC_LAG_DAYS,
  gscDateFrom,
  gscWindowBounds,
  gscWindows,
  windowDayCount,
} from "@/lib/seo/gsc/gsc-dates";

const NOW = Date.parse("2026-10-28T13:45:00Z");

describe("gscWindows", () => {
  it("produces two 28-day windows anchored at the GSC lag", () => {
    const w = gscWindows(NOW, 28);
    expect(w.current.end).toBe(gscDateFrom(NOW, GSC_LAG_DAYS));
    expect(w.current.end).toBe("2026-10-26");
    expect(w.current.start).toBe("2026-09-29");
    expect(w.previous.end).toBe("2026-09-28");
    expect(w.previous.start).toBe("2026-09-01");
    expect(windowDayCount(w.current)).toBe(28);
    expect(windowDayCount(w.previous)).toBe(28);
  });

  it("windows are contiguous and do not overlap", () => {
    const w = gscWindows(NOW, 28);
    const prevEnd = Date.parse(`${w.previous.end}T00:00:00Z`);
    const curStart = Date.parse(`${w.current.start}T00:00:00Z`);
    expect(curStart - prevEnd).toBe(24 * 60 * 60 * 1000);
  });

  it("respects a custom window length", () => {
    const w = gscWindows(NOW, 7);
    expect(windowDayCount(w.current)).toBe(7);
    expect(windowDayCount(w.previous)).toBe(7);
  });

  it("builds date-only Prisma bounds", () => {
    const b = gscWindowBounds({ start: "2026-09-29", end: "2026-10-26" });
    expect(b.gte.toISOString()).toBe("2026-09-29T00:00:00.000Z");
    expect(b.lte.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
});

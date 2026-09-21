import { describe, expect, it } from "vitest";
import { defaultReportMonth, jakartaToday, recentMonths } from "./period";

describe("period helpers", () => {
  it("jakartaToday memakai kalender WIB", () => {
    // 30 Sep 20:00 UTC = 1 Okt 03:00 WIB
    expect(jakartaToday(new Date("2026-09-30T20:00:00.000Z"))).toEqual({
      year: 2026,
      month: 10,
      day: 1,
    });
  });

  it("recentMonths: terbaru dulu, melewati pergantian tahun", () => {
    expect(recentMonths({ year: 2026, month: 2 }, 3)).toEqual([
      { year: 2026, month: 2 },
      { year: 2026, month: 1 },
      { year: 2025, month: 12 },
    ]);
  });

  it("defaultReportMonth: awal bulan berjalan → bulan yang baru ditutup", () => {
    const viewed = { year: 2026, month: 10 };
    expect(
      defaultReportMonth(viewed, new Date("2026-10-03T05:00:00.000Z")),
    ).toEqual({ year: 2026, month: 9 });
    expect(
      defaultReportMonth(viewed, new Date("2026-10-20T05:00:00.000Z")),
    ).toEqual(viewed);
    // Bulan lampau yang sedang dilihat tetap dipakai; bulan depan di-clamp.
    expect(
      defaultReportMonth(
        { year: 2026, month: 3 },
        new Date("2026-10-03T05:00:00.000Z"),
      ),
    ).toEqual({ year: 2026, month: 3 });
    expect(
      defaultReportMonth(
        { year: 2027, month: 1 },
        new Date("2026-10-20T05:00:00.000Z"),
      ),
    ).toEqual(viewed);
  });
});

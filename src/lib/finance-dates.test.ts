import { describe, expect, it } from "vitest";
import {
  utcDateOnly,
  utcEndOfDay,
  utcMonthEnd,
  utcMonthStart,
  utcPreviousMonthEnd,
  utcYearMonth,
} from "./finance-dates";

describe("finance-dates (UTC, M-10/M-11)", () => {
  it("utcPreviousMonthEnd tidak rollover untuk asOf tanggal 29-31 (M-11)", () => {
    // 31 Juli: setMonth(-1) lama menghasilkan 1 Juli; yang benar 30 Juni.
    expect(utcPreviousMonthEnd(new Date("2026-07-31T00:00:00Z")).toISOString()).toBe(
      "2026-06-30T23:59:59.999Z",
    );
    expect(utcPreviousMonthEnd(new Date("2026-03-31T00:00:00Z")).toISOString()).toBe(
      "2026-02-28T23:59:59.999Z",
    );
    expect(utcPreviousMonthEnd(new Date("2024-03-30T00:00:00Z")).toISOString()).toBe(
      "2024-02-29T23:59:59.999Z", // tahun kabisat
    );
  });

  it("batas bulan dibangun murni UTC", () => {
    expect(utcMonthStart(2026, 7).toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(utcMonthEnd(2026, 7).toISOString()).toBe("2026-07-31T23:59:59.999Z");
    expect(utcMonthEnd(2026, 2).toISOString()).toBe("2026-02-28T23:59:59.999Z");
    // month 0 dinormalisasi ke Desember tahun sebelumnya (untuk prevStart).
    expect(utcMonthStart(2026, 0).toISOString()).toBe("2025-12-01T00:00:00.000Z");
  });

  it("utcDateOnly & utcEndOfDay memakai komponen UTC, bukan lokal", () => {
    const d = new Date("2026-06-30T23:30:00Z"); // 1 Jul 06:30 WIB
    expect(utcDateOnly(d).toISOString()).toBe("2026-06-30T00:00:00.000Z");
    expect(utcEndOfDay(d).toISOString()).toBe("2026-06-30T23:59:59.999Z");
  });

  it("utcYearMonth mengikuti UTC untuk kasus lintas-tengah-malam", () => {
    // 30 Jun 20:00Z = 1 Jul 03:00 WIB — periode menurut buku (UTC) tetap Juni.
    expect(utcYearMonth(new Date("2026-06-30T20:00:00Z"))).toEqual({
      year: 2026,
      month: 6,
    });
  });
});

import { describe, expect, it } from "vitest";
import { formatRupiahInput, parseRupiahInput, rupiahShort } from "@/lib/kol/format";
import { kolSubNumber } from "@/lib/kol/numbering";
import {
  dateToWibInput,
  wibDayKey,
  wibInputToDate,
  wibYearMonthKey,
} from "@/lib/kol/time";

describe("waktu WIB", () => {
  it("input datetime-local WIB disimpan sebagai UTC", () => {
    expect(wibInputToDate("2026-10-02T19:00").toISOString()).toBe(
      "2026-10-02T12:00:00.000Z",
    );
  });

  it("round-trip ke input datetime-local", () => {
    expect(dateToWibInput(wibInputToDate("2026-12-31T23:30"))).toBe("2026-12-31T23:30");
  });

  it("hari & bulan dihitung menurut WIB, bukan UTC", () => {
    // 20:00 UTC 30 Sep = 03:00 WIB 1 Okt.
    const d = new Date("2026-09-30T20:00:00Z");
    expect(wibDayKey(d)).toBe("2026-10-01");
    expect(wibYearMonthKey(d)).toBe("2610");
  });

  it("menolak input rusak", () => {
    expect(() => wibInputToDate("bukan-tanggal")).toThrow();
  });
});

describe("format rupiah", () => {
  it("parse & format input", () => {
    expect(parseRupiahInput("Rp 1.500.000")).toBe("1500000");
    expect(formatRupiahInput("1500000")).toBe("1.500.000");
    expect(formatRupiahInput("")).toBe("");
  });

  it("ringkas", () => {
    expect(rupiahShort(1_500_000)).toBe("Rp 1,5 jt");
    expect(rupiahShort(750_000)).toBe("Rp 750 rb");
    expect(rupiahShort(null)).toBe("—");
  });
});

describe("penomoran", () => {
  it("sub nomor slot", () => {
    expect(kolSubNumber("KOL-2609-0012", 0)).toBe("KOL-2609-0012-01");
    expect(kolSubNumber("KOL-2609-0012", 10)).toBe("KOL-2609-0012-11");
  });
});

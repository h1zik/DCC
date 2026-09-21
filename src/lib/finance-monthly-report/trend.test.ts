import { describe, expect, it } from "vitest";
import { fillTrendMonths } from "./trend";

describe("fillTrendMonths", () => {
  it("mengisi bulan kosong dengan nol dan melewati pergantian tahun", () => {
    const pts = fillTrendMonths(
      [{ ym: "2026-01", type: "REVENUE", debit: "0", credit: "500" }],
      2026,
      4,
      6,
    );
    expect(pts.map((p) => `${p.year}-${p.month}`)).toEqual([
      "2025-11",
      "2025-12",
      "2026-1",
      "2026-2",
      "2026-3",
      "2026-4",
    ]);
    expect(pts[0]).toMatchObject({
      label: "Nov 25",
      revenue: "0",
      expense: "0",
      net: "0",
    });
    expect(pts[2].revenue).toBe("500");
  });

  it("pendapatan = kredit − debit, beban = debit − kredit", () => {
    const [p] = fillTrendMonths(
      [
        { ym: "2026-09", type: "REVENUE", debit: "100", credit: "1000" },
        { ym: "2026-09", type: "EXPENSE", debit: "700", credit: "50" },
      ],
      2026,
      9,
      1,
    );
    expect(p).toMatchObject({ revenue: "900", expense: "650", net: "250" });
  });
});

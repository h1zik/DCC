import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { computeBalanceSheetTotals } from "./finance-balance-sheet";

const D = (v: string | number) => new Prisma.Decimal(v);
const rows = (...vals: (string | number)[]) => vals.map((v) => ({ amount: D(v) }));

describe("computeBalanceSheetTotals (L-03)", () => {
  it("neraca seimbang → isBalanced true dengan selisih nol eksak", () => {
    const t = computeBalanceSheetTotals({
      assets: rows("1000000.10", "500000.15"),
      liabilities: rows("600000.05"),
      equity: rows("400000.10"),
      retainedEarnings: D("500000.10"),
    });
    expect(t.totalAssets.toFixed(2)).toBe("1500000.25");
    expect(t.totalEquity.toFixed(2)).toBe("900000.20");
    expect(t.isBalanced).toBe(true);
    expect(t.difference.isZero()).toBe(true);
  });

  it("selisih satu sen terdeteksi (float 0.1+0.2 tidak akan lolos jadi 'seimbang')", () => {
    const t = computeBalanceSheetTotals({
      assets: rows("0.10", "0.20"),
      liabilities: rows("0.29"),
      equity: [],
      retainedEarnings: D(0),
    });
    expect(t.isBalanced).toBe(false);
    expect(t.difference.toFixed(2)).toBe("0.01");
  });

  it("retained earnings masuk ke total ekuitas", () => {
    const t = computeBalanceSheetTotals({
      assets: rows(100),
      liabilities: [],
      equity: rows(40),
      retainedEarnings: D(60),
    });
    expect(t.totalEquity.toFixed(2)).toBe("100.00");
    expect(t.isBalanced).toBe(true);
  });
});

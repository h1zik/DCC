import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: { financeJournalEntry: { findMany: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { Prisma } from "@prisma/client";
import { buildCashFlowStatement, cashFlowCategoryFor } from "./finance-cashflow";

const D = (v: string) => new Prisma.Decimal(v);

function account(
  id: string,
  type: string,
  extra: Partial<{ tracksCashflow: boolean; isApControl: boolean; isArControl: boolean }> = {},
) {
  return {
    id,
    code: id,
    name: id,
    type,
    tracksCashflow: false,
    isApControl: false,
    isArControl: false,
    ...extra,
  };
}

function line(acc: ReturnType<typeof account>, debit: string, credit: string) {
  return {
    accountId: acc.id,
    debitBase: D(debit),
    creditBase: D(credit),
    brandId: null,
    account: acc,
  };
}

const bank = account("1100", "ASSET", { tracksCashflow: true });
const apControl = account("2000", "LIABILITY", { isApControl: true });
const arControl = account("1200", "ASSET", { isArControl: true });
const fixedAsset = account("1500", "ASSET");
const loan = account("2500", "LIABILITY");

beforeEach(() => vi.clearAllMocks());

describe("cashFlowCategoryFor", () => {
  it("akun kontrol AP/AR → operasi, apa pun tipe akunnya", () => {
    expect(cashFlowCategoryFor(apControl as never)).toBe("operating");
    expect(cashFlowCategoryFor(arControl as never)).toBe("operating");
  });

  it("akun lain tetap mengikuti tipe", () => {
    expect(cashFlowCategoryFor(fixedAsset as never)).toBe("investing");
    expect(cashFlowCategoryFor(loan as never)).toBe("financing");
  });
});

describe("buildCashFlowStatement", () => {
  it("bayar hutang usaha & terima piutang masuk operasi; total kas tidak berubah", async () => {
    mocks.prisma.financeJournalEntry.findMany.mockResolvedValue([
      { id: "pay-ap", lines: [line(apControl, "400", "0"), line(bank, "0", "400")] },
      { id: "recv-ar", lines: [line(bank, "1000", "0"), line(arControl, "0", "1000")] },
      { id: "buy-asset", lines: [line(fixedAsset, "250", "0"), line(bank, "0", "250")] },
      { id: "loan-in", lines: [line(bank, "5000", "0"), line(loan, "0", "5000")] },
    ]);

    const cf = await buildCashFlowStatement({
      from: new Date("2026-06-01T00:00:00Z"),
      to: new Date("2026-06-30T00:00:00Z"),
    });
    const net = (cat: string) =>
      cf.groups.find((g) => g.category === cat)!.net.toFixed(2);

    expect(net("operating")).toBe("600.00");
    expect(net("investing")).toBe("-250.00");
    expect(net("financing")).toBe("5000.00");
    expect(cf.netCash.toFixed(2)).toBe("5350.00");
  });

  it("batas hari dibentuk dalam UTC", async () => {
    mocks.prisma.financeJournalEntry.findMany.mockResolvedValue([]);
    await buildCashFlowStatement({
      from: new Date("2026-06-01T00:00:00Z"),
      to: new Date("2026-06-30T00:00:00Z"),
    });
    const where = mocks.prisma.financeJournalEntry.findMany.mock.calls[0][0].where;
    expect(where.entryDate.gte.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(where.entryDate.lte.toISOString()).toBe("2026-06-30T23:59:59.999Z");
  });
});

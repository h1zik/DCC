import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Regression test M-06: depresiasi bulanan harus idempoten per (tahun,bulan)
 * dan update akumulasi harus satu transaksi dengan jurnalnya.
 */

const D = (v: string | number) => new Prisma.Decimal(v);

const mocks = vi.hoisted(() => {
  const tx = {
    financeJournalEntry: { findFirst: vi.fn() },
    financeFixedAsset: { findMany: vi.fn(), update: vi.fn() },
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  };
  const prisma = {
    $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  const createPostedEntryInTx = vi.fn();
  return { prisma, tx, createPostedEntryInTx };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth-helpers", () => ({
  requireFinance: vi.fn(async () => ({ user: { id: "finance-1" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/finance-period-lock", () => ({
  ensurePeriodOpen: vi.fn(async () => {}),
}));
vi.mock("@/lib/finance-journal-post", () => ({
  createPostedEntryInTx: mocks.createPostedEntryInTx,
}));

import { postFinanceDepreciationForMonth } from "./finance-assets";

const asset = {
  id: "asset-1",
  name: "Laptop",
  cost: D(12000000),
  salvageValue: D(0),
  usefulLifeMonths: 12,
  accumulatedDepreciation: D(0),
  expenseAccountId: "acc-exp",
  accumAccountId: "acc-accum",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tx.$executeRaw.mockResolvedValue(0);
  mocks.tx.financeJournalEntry.findFirst.mockResolvedValue(null);
  mocks.tx.financeFixedAsset.findMany.mockResolvedValue([asset]);
  mocks.tx.financeFixedAsset.update.mockResolvedValue({});
  mocks.createPostedEntryInTx.mockResolvedValue("je-dep");
});

describe("postFinanceDepreciationForMonth — idempoten (M-06)", () => {
  it("run kedua untuk bulan yang sama ditolak", async () => {
    mocks.tx.financeJournalEntry.findFirst.mockResolvedValue({
      id: "je-old",
      entryNumber: "JE-2026-000005",
    });

    await expect(
      postFinanceDepreciationForMonth({ year: 2026, month: 6 }),
    ).rejects.toThrow(/sudah diposting/i);
    expect(mocks.createPostedEntryInTx).not.toHaveBeenCalled();
    expect(mocks.tx.financeFixedAsset.update).not.toHaveBeenCalled();
  });

  it("jurnal dan akumulasi memakai nilai 2 desimal yang sama, via increment dalam tx", async () => {
    await postFinanceDepreciationForMonth({ year: 2026, month: 6 });

    const call = mocks.createPostedEntryInTx.mock.calls[0][1];
    expect(call.reference).toBe("DEP-2026-06");
    expect(call.lines).toHaveLength(2);
    expect(call.lines[0].debit).toBe("1000000.00");

    expect(mocks.tx.financeFixedAsset.update).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: { accumulatedDepreciation: { increment: D("1000000") } },
    });
  });

  it("depresiasi di-cap pada sisa nilai buku", async () => {
    mocks.tx.financeFixedAsset.findMany.mockResolvedValue([
      { ...asset, accumulatedDepreciation: D(11999999.5) },
    ]);

    await postFinanceDepreciationForMonth({ year: 2026, month: 6 });

    const call = mocks.createPostedEntryInTx.mock.calls[0][1];
    expect(call.lines[0].debit).toBe("0.50");
  });

  it("tahun di luar batas ditolak skema", async () => {
    await expect(
      postFinanceDepreciationForMonth({ year: 999999, month: 6 }),
    ).rejects.toThrow();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("aset habis disusutkan → tidak ada jurnal", async () => {
    mocks.tx.financeFixedAsset.findMany.mockResolvedValue([
      { ...asset, accumulatedDepreciation: D(12000000) },
    ]);

    await expect(
      postFinanceDepreciationForMonth({ year: 2026, month: 6 }),
    ).rejects.toThrow(/tidak ada penyusutan/i);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Regression test M-07: mengubah tanggal draf harus menghitung ulang baris
 * valas dengan kurs tanggal baru — dulu debitBase & fxRateSnapshot tetap
 * memakai kurs tanggal lama.
 */

const D = (v: string | number) => new Prisma.Decimal(v);

const mocks = vi.hoisted(() => {
  const tx = {
    financeJournalEntry: { update: vi.fn() },
    financeJournalLine: { findMany: vi.fn(), update: vi.fn() },
    financeFxRate: { findFirst: vi.fn() },
  };
  const prisma = {
    financeJournalEntry: { findUniqueOrThrow: vi.fn() },
    $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  return { prisma, tx };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth-helpers", () => ({
  requireFinance: vi.fn(async () => ({ user: { id: "finance-1" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/finance-period-lock", () => ({
  ensurePeriodOpen: vi.fn(async () => {}),
}));

import { updateFinanceJournalHeader } from "./finance-journals";

const draft = {
  id: "entry-1",
  status: "DRAFT",
  entryDate: new Date("2026-06-01T00:00:00Z"),
};

const usdLine = {
  id: "line-usd",
  currencyCode: "USD",
  amountForeign: D(100),
  debitBase: D(1500000), // kurs lama 15.000
  creditBase: D(0),
  fxRateSnapshot: D(15000),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.financeJournalEntry.findUniqueOrThrow.mockResolvedValue(draft);
  mocks.tx.financeJournalEntry.update.mockResolvedValue({});
  mocks.tx.financeJournalLine.findMany.mockResolvedValue([usdLine]);
  mocks.tx.financeJournalLine.update.mockResolvedValue({});
  mocks.tx.financeFxRate.findFirst.mockResolvedValue({
    rateToBase: D("16234.567891"),
  });
});

function payload(entryDate: Date) {
  return { entryId: "entry-1", entryDate, reference: null, memo: null };
}

describe("updateFinanceJournalHeader — rekalkulasi FX saat tanggal berubah (M-07)", () => {
  it("baris valas dihitung ulang dengan kurs tanggal baru, dibulatkan 2dp", async () => {
    await updateFinanceJournalHeader(payload(new Date("2026-06-20T00:00:00Z")));

    expect(mocks.tx.financeJournalLine.update).toHaveBeenCalledWith({
      where: { id: "line-usd" },
      data: {
        // 100 × 16234.567891 = 1623456.7891 → 1623456.79
        debitBase: D("1623456.79"),
        fxRateSnapshot: D("16234.567891"),
      },
    });
  });

  it("kurs tanggal baru tidak ada → seluruh perubahan dibatalkan", async () => {
    mocks.tx.financeFxRate.findFirst.mockResolvedValue(null);

    await expect(
      updateFinanceJournalHeader(payload(new Date("2026-06-20T00:00:00Z"))),
    ).rejects.toThrow(/kurs usd/i);
  });

  it("tanggal tidak berubah → baris valas tidak disentuh", async () => {
    await updateFinanceJournalHeader(payload(new Date("2026-06-01T00:00:00Z")));

    expect(mocks.tx.financeJournalLine.findMany).not.toHaveBeenCalled();
    expect(mocks.tx.financeJournalLine.update).not.toHaveBeenCalled();
  });
});

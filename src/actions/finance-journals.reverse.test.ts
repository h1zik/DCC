import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Regression test H-06: reversal jurnal harus menyinkronkan sub-ledger —
 * payment AP/AR ikut terhapus + status dokumen dihitung ulang, dokumen hasil
 * CREATE_BILL/CREATE_INVOICE di-void, dan payout spend request dikembalikan.
 */

const D = (v: string | number) => new Prisma.Decimal(v);

const mocks = vi.hoisted(() => {
  const tx = {
    financeJournalEntry: {
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    financeApPayment: { findMany: vi.fn(), delete: vi.fn() },
    financeArPayment: { findMany: vi.fn(), delete: vi.fn() },
    financeApBill: { findUniqueOrThrow: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    financeArInvoice: { findUniqueOrThrow: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    financeJournalLineLink: { findMany: vi.fn() },
    financeSpendRequest: { findUnique: vi.fn(), update: vi.fn() },
    financeAuditEvent: { create: vi.fn() },
  };
  const prisma = {
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
vi.mock("@/lib/finance-journal-post", async () => {
  const actual = await vi.importActual<typeof import("@/lib/finance-journal-post")>(
    "@/lib/finance-journal-post",
  );
  return {
    ...actual,
    lockApBillForUpdate: vi.fn(async () => {}),
    lockArInvoiceForUpdate: vi.fn(async () => {}),
  };
});

import { reverseFinanceJournal } from "./finance-journals";

const targetBase = {
  id: "je-1",
  status: "POSTED",
  entryDate: new Date("2026-06-10T00:00:00Z"),
  entryNumber: "JE-2026-000010",
  reference: null,
  reversesEntryId: null,
  reversedBy: [] as Array<{ id: string; entryNumber: string | null }>,
  lines: [
    {
      accountId: "acc-a",
      debitBase: D(100000),
      creditBase: D(0),
      memo: null,
      brandId: null,
      currencyCode: "IDR",
      amountForeign: null,
      fxRateSnapshot: null,
    },
    {
      accountId: "acc-b",
      debitBase: D(0),
      creditBase: D(100000),
      memo: null,
      brandId: null,
      currencyCode: "IDR",
      amountForeign: null,
      fxRateSnapshot: null,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tx.financeJournalEntry.findUniqueOrThrow.mockResolvedValue(targetBase);
  mocks.tx.financeJournalEntry.findFirst.mockResolvedValue(null);
  mocks.tx.financeJournalEntry.create.mockResolvedValue({
    id: "je-2",
    entryNumber: "JE-2026-000011",
  });
  mocks.tx.financeApPayment.findMany.mockResolvedValue([]);
  mocks.tx.financeArPayment.findMany.mockResolvedValue([]);
  mocks.tx.financeJournalLineLink.findMany.mockResolvedValue([]);
  mocks.tx.financeSpendRequest.findUnique.mockResolvedValue(null);
  mocks.tx.financeAuditEvent.create.mockResolvedValue({});
  mocks.tx.financeApPayment.delete.mockResolvedValue({});
  mocks.tx.financeApBill.update.mockResolvedValue({});
  mocks.tx.financeArInvoice.update.mockResolvedValue({});
  mocks.tx.financeSpendRequest.update.mockResolvedValue({});
});

describe("reverseFinanceJournal — sinkronisasi sub-ledger (H-06)", () => {
  it("menghapus payment AP milik jurnal & menghitung ulang status bill", async () => {
    mocks.tx.financeApPayment.findMany.mockResolvedValue([
      { id: "pay-1", billId: "bill-1" },
    ]);
    // Setelah payment dihapus, tersisa satu payment 200rb dari bill 1jt.
    mocks.tx.financeApBill.findUniqueOrThrow.mockResolvedValue({
      id: "bill-1",
      status: "PAID",
      amount: D(1000000),
      payments: [{ amount: D(200000) }],
    });

    await reverseFinanceJournal({ entryId: "je-1" });

    expect(mocks.tx.financeApPayment.delete).toHaveBeenCalledWith({
      where: { id: "pay-1" },
    });
    expect(mocks.tx.financeApBill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: { status: "PARTIAL" },
    });
  });

  it("mem-void bill hasil CREATE_BILL yang belum berpayment", async () => {
    mocks.tx.financeJournalLineLink.findMany.mockResolvedValue([
      { createdBillId: "bill-9", createdInvoiceId: null },
    ]);
    mocks.tx.financeApBill.findUnique.mockResolvedValue({
      id: "bill-9",
      status: "OPEN",
      billNumber: "INV-9",
      payments: [],
    });

    await reverseFinanceJournal({ entryId: "je-1" });

    expect(mocks.tx.financeApBill.update).toHaveBeenCalledWith({
      where: { id: "bill-9" },
      data: { status: "VOID" },
    });
  });

  it("menolak reversal bila bill hasil jurnal sudah menerima pembayaran", async () => {
    mocks.tx.financeJournalLineLink.findMany.mockResolvedValue([
      { createdBillId: "bill-9", createdInvoiceId: null },
    ]);
    mocks.tx.financeApBill.findUnique.mockResolvedValue({
      id: "bill-9",
      status: "PARTIAL",
      billNumber: "INV-9",
      payments: [{ amount: D(50000) }],
    });

    await expect(reverseFinanceJournal({ entryId: "je-1" })).rejects.toThrow(
      /sudah menerima pembayaran/i,
    );
    expect(mocks.tx.financeJournalEntry.create).not.toHaveBeenCalled();
  });

  it("mengembalikan spend request PAID -> APPROVED bila payout-nya dibalik", async () => {
    mocks.tx.financeSpendRequest.findUnique.mockResolvedValue({ id: "req-1" });

    await reverseFinanceJournal({ entryId: "je-1" });

    expect(mocks.tx.financeSpendRequest.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { status: "APPROVED", payoutEntryId: null },
    });
  });

  it("menolak membalik jurnal pembalik", async () => {
    mocks.tx.financeJournalEntry.findUniqueOrThrow.mockResolvedValue({
      ...targetBase,
      reversesEntryId: "je-0",
    });

    await expect(reverseFinanceJournal({ entryId: "je-1" })).rejects.toThrow(
      /tidak dapat dibalik lagi/i,
    );
  });

  it("jurnal tanpa sub-ledger tetap terbalik normal", async () => {
    const result = await reverseFinanceJournal({ entryId: "je-1" });
    expect(result).toEqual({ id: "je-2", entryNumber: "JE-2026-000011" });
    const created = mocks.tx.financeJournalEntry.create.mock.calls[0][0].data;
    expect(created.reversesEntryId).toBe("je-1");
    // Sisi debit/kredit tertukar.
    expect(created.lines.create[0].debitBase).toEqual(D(0));
    expect(created.lines.create[0].creditBase).toEqual(D(100000));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression test H-03/M-05: pembayaran bill harus satu transaksi dengan
 * row-lock — cek sisa hutang, jurnal, payment, dan status tidak boleh
 * terpisah antar koneksi.
 */

const mocks = vi.hoisted(() => {
  const tx = {
    financeApBill: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    financeApPayment: { create: vi.fn() },
    financeLedgerAccount: { findUnique: vi.fn() },
    financeBankAccount: { findUniqueOrThrow: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  const createPostedEntryInTx = vi.fn();
  const lockApBillForUpdate = vi.fn(async () => {});
  const lockArInvoiceForUpdate = vi.fn(async () => {});
  return { prisma, tx, createPostedEntryInTx, lockApBillForUpdate, lockArInvoiceForUpdate };
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
  lockApBillForUpdate: mocks.lockApBillForUpdate,
  lockArInvoiceForUpdate: mocks.lockArInvoiceForUpdate,
}));

import { Prisma } from "@prisma/client";
import { recordApBillPayment } from "./finance-ap-ar";

const bill = {
  id: "bill-1",
  status: "OPEN",
  vendorName: "PT Maklon",
  billNumber: "INV-777",
  brandId: null,
  amount: new Prisma.Decimal("1000000"),
  payments: [{ amount: new Prisma.Decimal("400000") }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tx.financeApBill.findUniqueOrThrow.mockResolvedValue(bill);
  mocks.tx.financeApBill.update.mockResolvedValue({});
  mocks.tx.financeApPayment.create.mockResolvedValue({});
  mocks.tx.financeLedgerAccount.findUnique.mockResolvedValue({ id: "acc-2000" });
  mocks.tx.financeBankAccount.findUniqueOrThrow.mockResolvedValue({
    id: "bank-1",
    ledgerAccountId: "acc-bank",
  });
  mocks.createPostedEntryInTx.mockResolvedValue("je-77");
});

function payload(amount: string) {
  return {
    billId: "bill-1",
    amount,
    bankAccountId: "bank-1",
    paidAt: new Date("2026-06-20T00:00:00Z"),
  };
}

describe("recordApBillPayment — atomik + row-lock (H-03/M-05)", () => {
  it("mengunci bill sebelum membaca sisa hutang", async () => {
    await recordApBillPayment(payload("600000"));

    expect(mocks.lockApBillForUpdate).toHaveBeenCalledWith(mocks.tx, "bill-1");
    const lockOrder = mocks.lockApBillForUpdate.mock.invocationCallOrder[0];
    const readOrder =
      mocks.tx.financeApBill.findUniqueOrThrow.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(readOrder);
  });

  it("pelunasan penuh → payment tercatat dengan jurnal & status PAID", async () => {
    await recordApBillPayment(payload("600000"));

    expect(mocks.tx.financeApPayment.create).toHaveBeenCalledWith({
      data: {
        billId: "bill-1",
        amount: new Prisma.Decimal("600000"),
        journalEntryId: "je-77",
        recordedById: "finance-1",
      },
    });
    expect(mocks.tx.financeApBill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: { status: "PAID" },
    });
  });

  it("pembayaran sebagian → status PARTIAL", async () => {
    await recordApBillPayment(payload("100000"));
    expect(mocks.tx.financeApBill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: { status: "PARTIAL" },
    });
  });

  it("melebihi sisa hutang → ditolak tanpa jurnal/payment", async () => {
    await expect(recordApBillPayment(payload("600001"))).rejects.toThrow(
      /melebihi sisa/i,
    );
    expect(mocks.createPostedEntryInTx).not.toHaveBeenCalled();
    expect(mocks.tx.financeApPayment.create).not.toHaveBeenCalled();
  });

  it("bill VOID → ditolak", async () => {
    mocks.tx.financeApBill.findUniqueOrThrow.mockResolvedValue({
      ...bill,
      status: "VOID",
    });
    await expect(recordApBillPayment(payload("1000"))).rejects.toThrow(
      /tidak aktif/i,
    );
  });
});

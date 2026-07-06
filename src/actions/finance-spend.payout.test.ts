import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression test H-04: payout spend request harus klaim status via
 * compare-and-set SEBELUM membuat jurnal — dua pembayar paralel tidak boleh
 * menghasilkan dua jurnal payout.
 */

const mocks = vi.hoisted(() => {
  const tx = {
    financeSpendRequest: {
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    financeBankAccount: { findUniqueOrThrow: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  const createPostedEntryInTx = vi.fn();
  return { prisma, tx, createPostedEntryInTx };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth-helpers", () => ({
  requireFinance: vi.fn(async () => ({ user: { id: "payer-1" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/finance-period-lock", () => ({
  ensurePeriodOpen: vi.fn(async () => {}),
}));
vi.mock("@/lib/finance-journal-post", () => ({
  createPostedEntryInTx: mocks.createPostedEntryInTx,
}));

import { Prisma } from "@prisma/client";
import { recordFinanceSpendPayout } from "./finance-spend";

const approvedRequest = {
  id: "req-1",
  status: "APPROVED",
  payoutEntryId: null,
  expenseAccountId: "acc-exp",
  expenseAccount: { id: "acc-exp" },
  requestedById: "requester-1",
  brandId: null,
  title: "Beli ATK",
  amount: new Prisma.Decimal("150000"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tx.financeSpendRequest.findUniqueOrThrow.mockResolvedValue(approvedRequest);
  mocks.tx.financeSpendRequest.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.financeSpendRequest.update.mockResolvedValue({});
  mocks.tx.financeBankAccount.findUniqueOrThrow.mockResolvedValue({
    id: "bank-1",
    ledgerAccountId: "acc-bank",
  });
  mocks.createPostedEntryInTx.mockResolvedValue("je-99");
});

function payload() {
  return {
    requestId: "req-1",
    bankAccountId: "bank-1",
    paidAt: new Date("2026-06-20T00:00:00Z"),
  };
}

describe("recordFinanceSpendPayout — anti double-payout (H-04)", () => {
  it("mengklaim via CAS sebelum membuat jurnal", async () => {
    await recordFinanceSpendPayout(payload());

    expect(mocks.tx.financeSpendRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "req-1", status: "APPROVED", payoutEntryId: null },
      data: { status: "PAID" },
    });
    const claimOrder =
      mocks.tx.financeSpendRequest.updateMany.mock.invocationCallOrder[0];
    const journalOrder = mocks.createPostedEntryInTx.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(journalOrder);

    expect(mocks.tx.financeSpendRequest.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { payoutEntryId: "je-99" },
    });
  });

  it("klaim gagal (count 0) → berhenti TANPA membuat jurnal", async () => {
    mocks.tx.financeSpendRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(recordFinanceSpendPayout(payload())).rejects.toThrow(
      /sudah dibayar/i,
    );
    expect(mocks.createPostedEntryInTx).not.toHaveBeenCalled();
  });

  it("menolak payout oleh requester sendiri (segregation of duties)", async () => {
    mocks.tx.financeSpendRequest.findUniqueOrThrow.mockResolvedValue({
      ...approvedRequest,
      requestedById: "payer-1",
    });

    await expect(recordFinanceSpendPayout(payload())).rejects.toThrow(
      /segregation of duties/i,
    );
    expect(mocks.tx.financeSpendRequest.updateMany).not.toHaveBeenCalled();
  });

  it("menolak pengajuan yang belum APPROVED", async () => {
    mocks.tx.financeSpendRequest.findUniqueOrThrow.mockResolvedValue({
      ...approvedRequest,
      status: "SUBMITTED",
    });

    await expect(recordFinanceSpendPayout(payload())).rejects.toThrow(
      /disetujui/i,
    );
  });
});

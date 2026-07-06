import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression test H-01 (audit finance 2026-07-06): update baris jurnal harus
 * terikat pada entry yang status DRAFT-nya sudah diverifikasi. Sebelumnya
 * `update({ where: { id: lineId } })` tanpa entryId memungkinkan mengedit
 * baris milik jurnal POSTED lewat entryId draf milik sendiri.
 */

const mocks = vi.hoisted(() => {
  const tx = {
    financeJournalLine: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    financeJournalLineLink: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  const prisma = {
    financeJournalEntry: { findUniqueOrThrow: vi.fn() },
    financeLedgerAccount: { findUniqueOrThrow: vi.fn() },
    financeFxRate: { findFirst: vi.fn() },
    $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  return { prisma, tx };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth-helpers", () => ({
  requireFinance: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/finance-period-lock", () => ({
  ensurePeriodOpen: vi.fn(async () => {}),
}));
vi.mock("@/lib/finance-journal-number", () => ({
  nextJournalNumber: vi.fn(async () => "JE-2026-000001"),
}));

import { upsertFinanceJournalLine } from "./finance-journals";

const draftEntry = {
  id: "entry-1",
  status: "DRAFT",
  entryDate: new Date("2026-06-15T00:00:00Z"),
};

const plainAccount = {
  id: "acc-1",
  isApControl: false,
  isArControl: false,
};

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    entryId: "entry-1",
    accountId: "acc-1",
    debit: "100000",
    credit: "0",
    ...overrides,
  } as Parameters<typeof upsertFinanceJournalLine>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.financeJournalEntry.findUniqueOrThrow.mockResolvedValue(draftEntry);
  mocks.prisma.financeLedgerAccount.findUniqueOrThrow.mockResolvedValue(plainAccount);
  mocks.tx.financeJournalLine.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.financeJournalLine.create.mockResolvedValue({ id: "line-new" });
  mocks.tx.financeJournalLineLink.upsert.mockResolvedValue({});
  mocks.tx.financeJournalLineLink.deleteMany.mockResolvedValue({});
});

describe("upsertFinanceJournalLine — scoping lineId ke entryId (H-01)", () => {
  it("update baris memuat entryId di klausa where", async () => {
    await upsertFinanceJournalLine(baseInput({ lineId: "line-9" }));

    expect(mocks.tx.financeJournalLine.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.tx.financeJournalLine.updateMany.mock.calls[0][0].where).toEqual({
      id: "line-9",
      entryId: "entry-1",
    });
  });

  it("menolak bila baris bukan milik entry tersebut (count 0)", async () => {
    mocks.tx.financeJournalLine.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      upsertFinanceJournalLine(baseInput({ lineId: "line-posted" })),
    ).rejects.toThrow(/tidak ditemukan/i);
    expect(mocks.tx.financeJournalLine.create).not.toHaveBeenCalled();
  });

  it("menolak entry yang sudah POSTED sebelum menyentuh transaksi", async () => {
    mocks.prisma.financeJournalEntry.findUniqueOrThrow.mockResolvedValue({
      ...draftEntry,
      status: "POSTED",
    });

    await expect(
      upsertFinanceJournalLine(baseInput({ lineId: "line-9" })),
    ).rejects.toThrow(/sudah diposting/i);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("menolak nominal negatif", async () => {
    await expect(
      upsertFinanceJournalLine(baseInput({ debit: "-5", credit: "10" })),
    ).rejects.toThrow(/negatif/i);
  });

  it("tanpa lineId membuat baris baru pada entry yang sama", async () => {
    await upsertFinanceJournalLine(baseInput());

    expect(mocks.tx.financeJournalLine.create).toHaveBeenCalledTimes(1);
    expect(
      mocks.tx.financeJournalLine.create.mock.calls[0][0].data.entryId,
    ).toBe("entry-1");
  });
});

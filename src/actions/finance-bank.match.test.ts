import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression test M-15: match rekonsiliasi harus memvalidasi baris jurnal
 * (POSTED + akun ledger rekening yang sama) sebelum menautkan.
 */

const mocks = vi.hoisted(() => ({
  prisma: {
    bankStatementLine: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    financeJournalLine: { findUniqueOrThrow: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth-helpers", () => ({
  requireFinance: vi.fn(async () => ({ user: { id: "finance-1" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { matchBankStatementLine } from "./finance-bank";

const stmtLine = {
  id: "stmt-1",
  import: {
    bankAccount: { ledgerAccountId: "acc-bank", name: "BCA Operasional" },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.bankStatementLine.findUniqueOrThrow.mockResolvedValue(stmtLine);
  mocks.prisma.bankStatementLine.update.mockResolvedValue({});
  mocks.prisma.financeJournalLine.findUniqueOrThrow.mockResolvedValue({
    id: "line-1",
    accountId: "acc-bank",
    entry: { status: "POSTED" },
  });
});

describe("matchBankStatementLine — validasi (M-15)", () => {
  it("match valid → tautan tersimpan", async () => {
    await matchBankStatementLine({ statementLineId: "stmt-1", journalLineId: "line-1" });
    expect(mocks.prisma.bankStatementLine.update).toHaveBeenCalledWith({
      where: { id: "stmt-1" },
      data: { matchedJournalLineId: "line-1" },
    });
  });

  it("baris jurnal draf ditolak", async () => {
    mocks.prisma.financeJournalLine.findUniqueOrThrow.mockResolvedValue({
      id: "line-1",
      accountId: "acc-bank",
      entry: { status: "DRAFT" },
    });
    await expect(
      matchBankStatementLine({ statementLineId: "stmt-1", journalLineId: "line-1" }),
    ).rejects.toThrow(/terposting/i);
    expect(mocks.prisma.bankStatementLine.update).not.toHaveBeenCalled();
  });

  it("baris jurnal akun lain (mis. beban / rekening lain) ditolak", async () => {
    mocks.prisma.financeJournalLine.findUniqueOrThrow.mockResolvedValue({
      id: "line-1",
      accountId: "acc-beban",
      entry: { status: "POSTED" },
    });
    await expect(
      matchBankStatementLine({ statementLineId: "stmt-1", journalLineId: "line-1" }),
    ).rejects.toThrow(/bukan milik akun ledger/i);
  });

  it("unmatch (null) tidak butuh validasi", async () => {
    await matchBankStatementLine({ statementLineId: "stmt-1", journalLineId: null });
    expect(mocks.prisma.financeJournalLine.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(mocks.prisma.bankStatementLine.update).toHaveBeenCalledWith({
      where: { id: "stmt-1" },
      data: { matchedJournalLineId: null },
    });
  });
});

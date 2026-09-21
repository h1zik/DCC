import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tipe akun menentukan letak akun di Neraca vs Laba Rugi — tidak boleh diubah
 * setelah ada jurnal terposting. Kode yang masih dirujuk literal oleh sistem
 * juga tidak boleh di-rename.
 */

const mocks = vi.hoisted(() => ({
  prisma: {
    financeLedgerAccount: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    financeJournalLine: { count: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth-helpers", () => ({
  requireFinance: vi.fn(async () => ({ user: { id: "finance-1" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { upsertFinanceLedgerAccount } from "./finance-accounts";

const base = { id: "acc-1", code: "6000", name: "Beban umum", type: "EXPENSE" as const };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.financeLedgerAccount.findUniqueOrThrow.mockResolvedValue({
    code: "6000",
    type: "EXPENSE",
  });
  mocks.prisma.financeLedgerAccount.update.mockResolvedValue({});
});

describe("upsertFinanceLedgerAccount — kunci tipe & kode sistem", () => {
  it("menolak ganti tipe bila sudah ada baris jurnal terposting", async () => {
    mocks.prisma.financeJournalLine.count.mockResolvedValue(12);
    await expect(
      upsertFinanceLedgerAccount({ ...base, type: "ASSET" }),
    ).rejects.toThrow(/Tipe akun tidak bisa diubah/);
    expect(mocks.prisma.financeLedgerAccount.update).not.toHaveBeenCalled();
  });

  it("mengizinkan ganti tipe bila akun belum pernah dipakai", async () => {
    mocks.prisma.financeJournalLine.count.mockResolvedValue(0);
    await upsertFinanceLedgerAccount({ ...base, type: "ASSET" });
    expect(mocks.prisma.financeLedgerAccount.update).toHaveBeenCalled();
  });

  it("ganti nama/kode tanpa ganti tipe tidak memeriksa jurnal", async () => {
    await upsertFinanceLedgerAccount({ ...base, code: "6-000", name: "Beban G&A" });
    expect(mocks.prisma.financeJournalLine.count).not.toHaveBeenCalled();
    expect(mocks.prisma.financeLedgerAccount.update).toHaveBeenCalled();
  });

  it("menolak rename kode yang masih dirujuk sistem, nama tetap boleh", async () => {
    mocks.prisma.financeLedgerAccount.findUniqueOrThrow.mockResolvedValue({
      code: "3000",
      type: "EQUITY",
    });
    const equity = { id: "acc-eq", code: "3000", name: "Modal", type: "EQUITY" as const };
    await expect(
      upsertFinanceLedgerAccount({ ...equity, code: "3-000" }),
    ).rejects.toThrow(/dipakai sistem/);
    await upsertFinanceLedgerAccount({ ...equity, name: "Modal disetor" });
    expect(mocks.prisma.financeLedgerAccount.update).toHaveBeenCalledTimes(1);
  });
});

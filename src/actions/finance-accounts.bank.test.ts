import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Akun Aktiva ber-flag arus kas otomatis terdaftar sebagai rekening saat
 * disimpan dari Chart of Accounts — tanpa menduplikasi rekening yang sudah ada.
 */

const mocks = vi.hoisted(() => {
  const prisma = {
    financeLedgerAccount: {
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    financeJournalLine: { count: vi.fn() },
    financeBankAccount: { count: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
  };
  return { prisma, createBankAccountInTx: vi.fn(async () => "bank-1") };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth-helpers", () => ({
  requireFinance: vi.fn(async () => ({ user: { id: "finance-1" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/finance-audit", () => ({ logFinanceAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/finance-bank-account", () => ({
  createBankAccountInTx: mocks.createBankAccountInTx,
}));

import { upsertFinanceLedgerAccount } from "./finance-accounts";

const cashLedger = {
  id: "acc-1",
  name: "Bank Mandiri",
  type: "ASSET" as const,
  isActive: true,
  tracksCashflow: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.financeLedgerAccount.create.mockResolvedValue(cashLedger);
  mocks.prisma.financeBankAccount.count.mockResolvedValue(0);
});

describe("upsertFinanceLedgerAccount — rekening otomatis", () => {
  it("akun Aktiva arus kas baru didaftarkan sebagai rekening dengan saldo awal", async () => {
    await upsertFinanceLedgerAccount({
      code: "1030",
      name: "Bank Mandiri",
      type: "ASSET",
      tracksCashflow: true,
      bank: {
        institution: "Mandiri",
        accountMask: "1234",
        openingBalance: "5000000",
        openingAsOf: new Date("2026-09-01"),
      },
    });
    expect(mocks.createBankAccountInTx).toHaveBeenCalledTimes(1);
    const [, input] = mocks.createBankAccountInTx.mock.calls[0] as unknown as [
      unknown,
      { name: string; ledgerAccountId: string; opening: { toFixed: (n: number) => string } },
    ];
    expect(input.name).toBe("Bank Mandiri");
    expect(input.ledgerAccountId).toBe("acc-1");
    expect(input.opening.toFixed(2)).toBe("5000000.00");
  });

  it("tidak membuat rekening kedua bila akun sudah punya rekening", async () => {
    mocks.prisma.financeBankAccount.count.mockResolvedValue(1);
    await upsertFinanceLedgerAccount({
      code: "1030",
      name: "Bank Mandiri",
      type: "ASSET",
      tracksCashflow: true,
    });
    expect(mocks.createBankAccountInTx).not.toHaveBeenCalled();
  });

  it("akun non-kas atau non-Aktiva tidak jadi rekening", async () => {
    mocks.prisma.financeLedgerAccount.create.mockResolvedValue({
      ...cashLedger,
      tracksCashflow: false,
    });
    await upsertFinanceLedgerAccount({
      code: "1500",
      name: "Persediaan",
      type: "ASSET",
      tracksCashflow: false,
    });
    mocks.prisma.financeLedgerAccount.create.mockResolvedValue({
      ...cashLedger,
      type: "EXPENSE",
    });
    await upsertFinanceLedgerAccount({
      code: "6000",
      name: "Beban",
      type: "EXPENSE",
      tracksCashflow: true,
    });
    expect(mocks.createBankAccountInTx).not.toHaveBeenCalled();
  });

  it("mengedit akun kas lama tanpa rekening mendaftarkannya dengan saldo awal 0", async () => {
    mocks.prisma.financeLedgerAccount.findUniqueOrThrow.mockResolvedValue({
      code: "1010",
      name: "Kas kecil",
      type: "ASSET",
      isActive: true,
      tracksCashflow: true,
      isApControl: false,
      isArControl: false,
    });
    mocks.prisma.financeLedgerAccount.update.mockResolvedValue({
      code: "1010",
      name: "Kas kecil",
      type: "ASSET",
      isActive: true,
      tracksCashflow: true,
      isApControl: false,
      isArControl: false,
    });
    await upsertFinanceLedgerAccount({
      id: "acc-kas",
      code: "1010",
      name: "Kas kecil",
      type: "ASSET",
      tracksCashflow: true,
    });
    const [, input] = mocks.createBankAccountInTx.mock.calls[0] as unknown as [
      unknown,
      { ledgerAccountId: string; opening: { isZero: () => boolean } },
    ];
    expect(input.ledgerAccountId).toBe("acc-kas");
    expect(input.opening.isZero()).toBe(true);
  });
});

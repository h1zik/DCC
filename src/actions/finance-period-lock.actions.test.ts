import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression test H-12/M-21: unlock periode harus meninggalkan jejak audit
 * (siapa membuka, kapan, kunci asli milik siapa), dan lock ulang tidak boleh
 * menimpa jejak pengunci asli.
 */

const mocks = vi.hoisted(() => {
  const tx = {
    financePeriodLock: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    financeAuditEvent: { create: vi.fn() },
  };
  const prisma = {
    financePeriodLock: { findUnique: vi.fn() },
    $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  return { prisma, tx };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth-helpers", () => ({
  requireFinance: vi.fn(async () => ({ user: { id: "finance-1" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/finance-period-lock", () => ({
  listPeriodLocks: vi.fn(async () => []),
}));

import { lockFinancePeriod, unlockFinancePeriod } from "./finance-period-lock";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tx.financePeriodLock.create.mockResolvedValue({});
  mocks.tx.financePeriodLock.delete.mockResolvedValue({});
  mocks.tx.financeAuditEvent.create.mockResolvedValue({});
});

describe("unlockFinancePeriod — jejak audit (H-12)", () => {
  it("menulis audit PERIOD_UNLOCK berisi jejak kunci asli SEBELUM menghapus", async () => {
    mocks.tx.financePeriodLock.findUnique.mockResolvedValue({
      id: "lock-1",
      lockedAt: new Date("2026-06-01T00:00:00Z"),
      lockedById: "ceo-1",
      reason: "tutup buku Mei",
      lockedBy: { name: "Bu CEO", email: "ceo@x.co" },
    });

    await unlockFinancePeriod({ year: 2026, month: 5 });

    const auditArgs = mocks.tx.financeAuditEvent.create.mock.calls[0][0].data;
    expect(auditArgs.action).toBe("PERIOD_UNLOCK");
    expect(auditArgs.actorId).toBe("finance-1");
    expect(auditArgs.entityId).toBe("2026-05");
    expect(auditArgs.detail).toContain("Bu CEO");
    expect(auditArgs.detail).toContain("tutup buku Mei");

    const auditOrder = mocks.tx.financeAuditEvent.create.mock.invocationCallOrder[0];
    const deleteOrder = mocks.tx.financePeriodLock.delete.mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(deleteOrder);
  });

  it("periode yang tidak terkunci = no-op tanpa audit", async () => {
    mocks.tx.financePeriodLock.findUnique.mockResolvedValue(null);
    await unlockFinancePeriod({ year: 2026, month: 5 });
    expect(mocks.tx.financeAuditEvent.create).not.toHaveBeenCalled();
    expect(mocks.tx.financePeriodLock.delete).not.toHaveBeenCalled();
  });
});

describe("lockFinancePeriod — idempoten (M-21)", () => {
  it("periode yang sudah terkunci tidak ditimpa (jejak pengunci asli utuh)", async () => {
    mocks.prisma.financePeriodLock.findUnique.mockResolvedValue({ id: "lock-1" });

    await lockFinancePeriod({ year: 2026, month: 5 });

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.tx.financePeriodLock.create).not.toHaveBeenCalled();
  });

  it("penguncian baru mencatat audit PERIOD_LOCK dalam transaksi yang sama", async () => {
    mocks.prisma.financePeriodLock.findUnique.mockResolvedValue(null);

    await lockFinancePeriod({ year: 2026, month: 5, reason: "tutup buku" });

    expect(mocks.tx.financePeriodLock.create).toHaveBeenCalledTimes(1);
    const auditArgs = mocks.tx.financeAuditEvent.create.mock.calls[0][0].data;
    expect(auditArgs.action).toBe("PERIOD_LOCK");
    expect(auditArgs.entityId).toBe("2026-05");
  });
});

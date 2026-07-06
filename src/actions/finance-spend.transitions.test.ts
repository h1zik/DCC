import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression test L-01: transisi status spend request memakai compare-and-set
 * — dua keputusan bersamaan (approve vs reject) tidak boleh saling menimpa
 * diam-diam.
 */

const mocks = vi.hoisted(() => ({
  prisma: {
    financeSpendRequest: {
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth-helpers", () => ({
  requireFinance: vi.fn(async () => ({ user: { id: "approver-1" } })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/finance-period-lock", () => ({
  ensurePeriodOpen: vi.fn(async () => {}),
}));
vi.mock("@/lib/finance-journal-post", () => ({
  createPostedEntryInTx: vi.fn(),
}));

import {
  approveFinanceSpendRequest,
  rejectFinanceSpendRequest,
  submitFinanceSpendRequest,
} from "./finance-spend";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.financeSpendRequest.updateMany.mockResolvedValue({ count: 1 });
});

describe("transisi status spend request — CAS (L-01)", () => {
  it("approve memakai kondisi status SUBMITTED di where", async () => {
    mocks.prisma.financeSpendRequest.findUniqueOrThrow.mockResolvedValue({
      id: "req-1",
      status: "SUBMITTED",
      requestedById: "requester-1",
    });

    await approveFinanceSpendRequest("req-1", "ok");

    expect(mocks.prisma.financeSpendRequest.updateMany.mock.calls[0][0].where).toEqual({
      id: "req-1",
      status: "SUBMITTED",
    });
  });

  it("kalah race (count 0) → error ramah, bukan menimpa keputusan pertama", async () => {
    mocks.prisma.financeSpendRequest.findUniqueOrThrow.mockResolvedValue({
      id: "req-1",
      status: "SUBMITTED",
      requestedById: "requester-1",
    });
    mocks.prisma.financeSpendRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(rejectFinanceSpendRequest("req-1")).rejects.toThrow(
      /sudah diputuskan/i,
    );
  });

  it("submit hanya dari DRAFT (CAS)", async () => {
    mocks.prisma.financeSpendRequest.findUniqueOrThrow.mockResolvedValue({
      id: "req-1",
      status: "DRAFT",
      requestedById: "approver-1",
    });
    mocks.prisma.financeSpendRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(submitFinanceSpendRequest("req-1")).rejects.toThrow(
      /sudah berubah/i,
    );
  });

  it("approve oleh requester sendiri tetap ditolak sebelum CAS", async () => {
    mocks.prisma.financeSpendRequest.findUniqueOrThrow.mockResolvedValue({
      id: "req-1",
      status: "SUBMITTED",
      requestedById: "approver-1",
    });

    await expect(approveFinanceSpendRequest("req-1")).rejects.toThrow(
      /segregation of duties/i,
    );
    expect(mocks.prisma.financeSpendRequest.updateMany).not.toHaveBeenCalled();
  });
});

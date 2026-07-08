import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    xpLedger: { createMany: vi.fn(), aggregate: vi.fn() },
    userProgression: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { cumXp, levelFromXp } from "./level";
import { grantXp, recomputeProgression } from "./grant";

beforeEach(() => {
  vi.clearAllMocks();
  // $transaction(cb) → jalankan cb dengan prisma mock sebagai tx.
  mocks.prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
    cb(mocks.prisma),
  );
  mocks.prisma.userProgression.upsert.mockResolvedValue({});
});

describe("grantXp idempotency", () => {
  it("grants XP and recomputes level on a fresh ledger row", async () => {
    mocks.prisma.xpLedger.createMany.mockResolvedValue({ count: 1 });
    mocks.prisma.userProgression.findUnique.mockResolvedValue(null);

    const r = await grantXp({
      userId: "u1",
      amount: 100,
      reason: "ATTENDANCE",
      dedupeKey: "attendance:u1:2026-07-08",
    });

    expect(r.granted).toBe(true);
    expect(r.xpTotal).toBe(100);
    expect(r.level).toBe(levelFromXp(100)); // 2
    expect(r.leveledUp).toBe(true);
    expect(mocks.prisma.userProgression.upsert).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when the dedupeKey already exists", async () => {
    mocks.prisma.xpLedger.createMany.mockResolvedValue({ count: 0 });
    mocks.prisma.userProgression.findUnique.mockResolvedValue({
      level: 4,
      xpTotal: 500,
    });

    const r = await grantXp({
      userId: "u1",
      amount: 100,
      reason: "ATTENDANCE",
      dedupeKey: "attendance:u1:2026-07-08",
    });

    expect(r.granted).toBe(false);
    expect(r.xpTotal).toBe(500);
    expect(r.level).toBe(4);
    expect(mocks.prisma.userProgression.upsert).not.toHaveBeenCalled();
  });

  it("never lowers the stored level", async () => {
    mocks.prisma.xpLedger.createMany.mockResolvedValue({ count: 1 });
    mocks.prisma.userProgression.findUnique.mockResolvedValue({
      level: 5,
      xpTotal: 740, // exactly level 5
    });

    const r = await grantXp({
      userId: "u1",
      amount: 10,
      reason: "ATTENDANCE",
      dedupeKey: "k",
    });

    expect(r.level).toBe(5); // 750 xp still level 5, and floor holds anyway
    expect(r.leveledUp).toBe(false);
  });

  it("honors an explicit levelFloor (tenure backfill)", async () => {
    mocks.prisma.xpLedger.createMany.mockResolvedValue({ count: 1 });
    mocks.prisma.userProgression.findUnique.mockResolvedValue(null);

    const seeded = cumXp(3); // 250
    const r = await grantXp({
      userId: "u1",
      amount: seeded,
      reason: "TENURE",
      dedupeKey: "tenure:u1",
      levelFloor: 3,
    });

    expect(r.xpTotal).toBe(seeded);
    expect(r.level).toBe(3);
  });
});

describe("recomputeProgression self-heal", () => {
  it("recomputes xpTotal from the ledger and never lowers level", async () => {
    mocks.prisma.xpLedger.aggregate.mockResolvedValue({ _sum: { amount: 300 } });
    mocks.prisma.userProgression.findUnique.mockResolvedValue({
      level: 6,
      xpTotal: 999,
    });

    const r = await recomputeProgression("u1");
    expect(r.xpTotal).toBe(300);
    expect(r.level).toBe(6); // levelFromXp(300)=3, but stored 6 is the floor
    expect(mocks.prisma.userProgression.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { xpTotal: 300, level: 6 },
      }),
    );
  });
});

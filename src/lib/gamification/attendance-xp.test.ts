import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    userProgression: { findUnique: vi.fn(), update: vi.fn() },
  },
  grantXp: vi.fn(),
  flagOn: { value: true },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("./grant", () => ({ grantXp: mocks.grantXp }));
vi.mock("./flag", () => ({
  isProfileGamificationEnabled: () => mocks.flagOn.value,
}));

import { onVerifiedCheckIn } from "./attendance-xp";

// 08:00 WIB (on-time), 10:00 WIB (late)
const ON_TIME = new Date("2026-07-08T01:00:00Z");
const LATE = new Date("2026-07-08T03:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.flagOn.value = true;
  mocks.prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
    cb(mocks.prisma),
  );
  mocks.prisma.userProgression.update.mockResolvedValue({});
  mocks.grantXp.mockResolvedValue({
    granted: true,
    leveledUp: false,
    level: 2,
    previousLevel: 2,
    xpTotal: 0,
  });
});

describe("onVerifiedCheckIn", () => {
  it("applies the streak multiplier when on-time and updates the streak", async () => {
    mocks.prisma.userProgression.findUnique.mockResolvedValue({
      attendanceStreak: 6,
      longestAttendanceStreak: 6,
      lastCheckinDate: "2026-07-07", // consecutive → streak becomes 7 → ×1.5
    });

    const r = await onVerifiedCheckIn({
      userId: "u1",
      date: "2026-07-08",
      timestamp: ON_TIME,
      employmentType: "EMPLOYEE",
    });

    expect(r.streak).toBe(7);
    expect(r.amount).toBe(15); // round(10 * 1.5)
    expect(mocks.grantXp).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 15,
        reason: "ATTENDANCE",
        dedupeKey: "attendance:u1:2026-07-08",
      }),
    );
    expect(mocks.prisma.userProgression.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attendanceStreak: 7,
          longestAttendanceStreak: 7,
          lastCheckinDate: "2026-07-08",
        }),
      }),
    );
  });

  it("gives flat base XP (no multiplier) when late", async () => {
    mocks.prisma.userProgression.findUnique.mockResolvedValue({
      attendanceStreak: 20,
      longestAttendanceStreak: 20,
      lastCheckinDate: "2026-07-07",
    });
    const r = await onVerifiedCheckIn({
      userId: "u1",
      date: "2026-07-08",
      timestamp: LATE,
      employmentType: "EMPLOYEE",
    });
    expect(r.onTime).toBe(false);
    expect(r.amount).toBe(10); // base only, despite streak 21
  });

  it("does not update streak on a duplicate same-day grant", async () => {
    mocks.prisma.userProgression.findUnique.mockResolvedValue({
      attendanceStreak: 3,
      longestAttendanceStreak: 5,
      lastCheckinDate: "2026-07-08",
    });
    mocks.grantXp.mockResolvedValue({
      granted: false,
      leveledUp: false,
      level: 2,
      previousLevel: 2,
      xpTotal: 0,
    });
    await onVerifiedCheckIn({
      userId: "u1",
      date: "2026-07-08",
      timestamp: ON_TIME,
      employmentType: "EMPLOYEE",
    });
    expect(mocks.prisma.userProgression.update).not.toHaveBeenCalled();
  });

  it("skips FREELANCE users", async () => {
    const r = await onVerifiedCheckIn({
      userId: "u1",
      date: "2026-07-08",
      timestamp: ON_TIME,
      employmentType: "FREELANCE",
    });
    expect(r.granted).toBe(false);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("no-ops when the feature flag is off", async () => {
    mocks.flagOn.value = false;
    await onVerifiedCheckIn({
      userId: "u1",
      date: "2026-07-08",
      timestamp: ON_TIME,
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});

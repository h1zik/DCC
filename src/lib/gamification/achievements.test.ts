import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    achievement: { findMany: vi.fn() },
    userProgression: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    xpLedger: { count: vi.fn() },
    attendance: { findMany: vi.fn() },
    userAchievement: { findMany: vi.fn(), upsert: vi.fn() },
    cosmeticItem: { findUnique: vi.fn() },
    userCosmetic: { createMany: vi.fn() },
  },
  grantXp: vi.fn(),
  notifyUser: vi.fn(),
  flagOn: { value: true },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/notify", () => ({ notifyUser: mocks.notifyUser }));
vi.mock("./grant", () => ({ grantXp: mocks.grantXp }));
vi.mock("./flag", () => ({
  isProfileGamificationEnabled: () => mocks.flagOn.value,
}));

import {
  evaluateAchievements,
  evaluateCriteria,
  type AchievementFacts,
} from "./achievements";

const FACTS: AchievementFacts = {
  longestStreak: 7,
  currentStreak: 7,
  level: 3,
  taskOntimeCount: 12,
  tenureDays: 200,
  checkinBeforeHour: { 7: 5 },
};

describe("evaluateCriteria", () => {
  it("attendance_streak", () => {
    expect(evaluateCriteria({ type: "attendance_streak", threshold: 7 }, FACTS).satisfied).toBe(true);
    expect(evaluateCriteria({ type: "attendance_streak", threshold: 8 }, FACTS).satisfied).toBe(false);
  });
  it("task_ontime_count reports progress", () => {
    const r = evaluateCriteria({ type: "task_ontime_count", threshold: 10 }, FACTS);
    expect(r.progress).toBe(12);
    expect(r.satisfied).toBe(true);
  });
  it("tenure_days & level_reached", () => {
    expect(evaluateCriteria({ type: "tenure_days", threshold: 180 }, FACTS).satisfied).toBe(true);
    expect(evaluateCriteria({ type: "level_reached", threshold: 10 }, FACTS).satisfied).toBe(false);
  });
  it("checkin_before_hour reads the hour bucket", () => {
    expect(evaluateCriteria({ type: "checkin_before_hour", hour: 7, count: 5 }, FACTS).satisfied).toBe(true);
    expect(evaluateCriteria({ type: "checkin_before_hour", hour: 7, count: 6 }, FACTS).satisfied).toBe(false);
  });
  it("marks unimplemented criteria as unsupported (locked)", () => {
    const r = evaluateCriteria({ type: "zero_overdue_days", threshold: 7 }, FACTS);
    expect(r.satisfied).toBe(false);
    expect(r.unsupported).toBe(true);
  });
});

describe("evaluateAchievements unlock flow", () => {
  const ATT7 = {
    id: "a1",
    key: "attendance_7",
    name: "Rajin Seminggu",
    criteria: { type: "attendance_streak", threshold: 7 },
    xpReward: 100,
    unlocksCosmeticKey: "border-orbit",
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flagOn.value = true;
    mocks.prisma.achievement.findMany.mockResolvedValue([ATT7]);
    mocks.prisma.userProgression.findUnique.mockResolvedValue({
      longestAttendanceStreak: 7,
      attendanceStreak: 7,
      level: 3,
    });
    mocks.prisma.user.findUnique.mockResolvedValue({ createdAt: new Date() });
    mocks.prisma.xpLedger.count.mockResolvedValue(0);
    mocks.prisma.attendance.findMany.mockResolvedValue([]);
    mocks.prisma.userAchievement.findMany.mockResolvedValue([]);
    mocks.prisma.userAchievement.upsert.mockResolvedValue({});
    mocks.prisma.cosmeticItem.findUnique.mockResolvedValue({ id: "cos1" });
    mocks.prisma.userCosmetic.createMany.mockResolvedValue({ count: 1 });
    mocks.grantXp.mockResolvedValue({ granted: true });
  });

  it("unlocks: sets unlockedAt, grants XP + cosmetic, notifies", async () => {
    const unlocked = await evaluateAchievements("u1");

    expect(unlocked).toEqual(["attendance_7"]);
    expect(mocks.grantXp).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 100,
        reason: "ACHIEVEMENT",
        dedupeKey: "achievement:u1:attendance_7",
      }),
    );
    expect(mocks.prisma.cosmeticItem.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "border-orbit" } }),
    );
    expect(mocks.prisma.userCosmetic.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ userId: "u1", cosmeticItemId: "cos1", source: "ACHIEVEMENT" }],
        skipDuplicates: true,
      }),
    );
    expect(mocks.notifyUser).toHaveBeenCalledTimes(1);
  });

  it("does not re-unlock or re-notify an already-unlocked achievement", async () => {
    mocks.prisma.userAchievement.findMany.mockResolvedValue([
      { achievementId: "a1", unlockedAt: new Date() },
    ]);
    const unlocked = await evaluateAchievements("u1");
    expect(unlocked).toEqual([]);
    expect(mocks.grantXp).not.toHaveBeenCalled();
    expect(mocks.notifyUser).not.toHaveBeenCalled();
    expect(mocks.prisma.userAchievement.upsert).toHaveBeenCalledTimes(1); // progress only
  });

  it("skips notification during backfill (notify:false) but still grants", async () => {
    await evaluateAchievements("u1", { notify: false });
    expect(mocks.grantXp).toHaveBeenCalledTimes(1);
    expect(mocks.notifyUser).not.toHaveBeenCalled();
  });

  it("no-ops when the feature flag is off", async () => {
    mocks.flagOn.value = false;
    const unlocked = await evaluateAchievements("u1");
    expect(unlocked).toEqual([]);
    expect(mocks.prisma.achievement.findMany).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { count: vi.fn() },
    attendance: { findMany: vi.fn() },
    task: { findMany: vi.fn() },
    userProgression: { aggregate: vi.fn(), count: vi.fn() },
    userAchievement: { count: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { getGamificationMetrics } from "./metrics";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.user.count.mockResolvedValue(8); // employees
  mocks.prisma.attendance.findMany
    .mockResolvedValueOnce([{ userId: "a" }, { userId: "b" }]) // 7d: 2/8
    .mockResolvedValueOnce([{ userId: "a" }, { userId: "b" }, { userId: "c" }]); // 28d: 3/8
  mocks.prisma.task.findMany.mockResolvedValue([
    { completedAt: new Date("2026-07-08T00:00:00Z"), dueDate: new Date("2026-07-08T10:00:00Z") }, // on-time
    { completedAt: new Date("2026-07-09T00:00:00Z"), dueDate: new Date("2026-07-08T10:00:00Z") }, // late
    { completedAt: new Date("2026-07-05T00:00:00Z"), dueDate: new Date("2026-07-06T10:00:00Z") }, // on-time
  ]);
  mocks.prisma.userProgression.aggregate.mockResolvedValue({ _avg: { level: 4.5 } });
  mocks.prisma.userProgression.count.mockResolvedValue(8);
  mocks.prisma.userAchievement.count.mockResolvedValue(11);
});

describe("getGamificationMetrics", () => {
  it("computes adoption and on-time rates", async () => {
    const m = await getGamificationMetrics();
    expect(m.employees).toBe(8);
    expect(m.activeCheckin7d).toBe(2);
    expect(m.adoption7d).toBeCloseTo(2 / 8);
    expect(m.adoption28d).toBeCloseTo(3 / 8);
    expect(m.tasksDone28d).toBe(3);
    expect(m.tasksOntime28d).toBe(2);
    expect(m.ontimeRate28d).toBeCloseTo(2 / 3);
    expect(m.avgLevel).toBe(4.5);
    expect(m.achievementsUnlocked).toBe(11);
  });

  it("avoids divide-by-zero with no employees/tasks", async () => {
    mocks.prisma.user.count.mockResolvedValue(0);
    mocks.prisma.attendance.findMany.mockReset().mockResolvedValue([]);
    mocks.prisma.task.findMany.mockResolvedValue([]);
    const m = await getGamificationMetrics();
    expect(m.adoption7d).toBe(0);
    expect(m.ontimeRate28d).toBe(0);
  });
});

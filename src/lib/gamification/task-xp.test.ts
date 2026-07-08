import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: { task: { findUnique: vi.fn() } },
  grantXp: vi.fn(),
  flagOn: { value: true },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("./grant", () => ({ grantXp: mocks.grantXp }));
vi.mock("./flag", () => ({
  isProfileGamificationEnabled: () => mocks.flagOn.value,
}));

import { isTaskOnTime, onTaskDone } from "./task-xp";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.flagOn.value = true;
  mocks.grantXp.mockResolvedValue({ granted: true });
});

describe("isTaskOnTime", () => {
  it("treats null dueDate as on-time", () => {
    expect(isTaskOnTime(new Date(), null)).toBe(true);
  });
  it("is on-time when completed on/before due", () => {
    expect(
      isTaskOnTime(new Date("2026-07-08T00:00:00Z"), new Date("2026-07-08T10:00:00Z")),
    ).toBe(true);
  });
  it("is late when completed after due", () => {
    expect(
      isTaskOnTime(new Date("2026-07-09T00:00:00Z"), new Date("2026-07-08T10:00:00Z")),
    ).toBe(false);
  });
  it("is not on-time without a completion timestamp", () => {
    expect(isTaskOnTime(null, null)).toBe(false);
  });
});

describe("onTaskDone", () => {
  it("grants once per assignee when on-time", async () => {
    mocks.prisma.task.findUnique.mockResolvedValue({
      id: "t1",
      completedAt: new Date("2026-07-08T00:00:00Z"),
      dueDate: new Date("2026-07-08T10:00:00Z"),
      assignees: [{ userId: "u1" }, { userId: "u2" }],
    });

    await onTaskDone("t1");

    expect(mocks.grantXp).toHaveBeenCalledTimes(2);
    expect(mocks.grantXp).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        reason: "TASK_ONTIME",
        dedupeKey: "task_ontime:t1:u1",
      }),
    );
    expect(mocks.grantXp).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: "task_ontime:t1:u2" }),
    );
  });

  it("grants nothing for an overdue close (no penalty)", async () => {
    mocks.prisma.task.findUnique.mockResolvedValue({
      id: "t1",
      completedAt: new Date("2026-07-09T00:00:00Z"),
      dueDate: new Date("2026-07-08T10:00:00Z"),
      assignees: [{ userId: "u1" }],
    });
    await onTaskDone("t1");
    expect(mocks.grantXp).not.toHaveBeenCalled();
  });

  it("skips when completedAt is not set", async () => {
    mocks.prisma.task.findUnique.mockResolvedValue({
      id: "t1",
      completedAt: null,
      dueDate: null,
      assignees: [{ userId: "u1" }],
    });
    await onTaskDone("t1");
    expect(mocks.grantXp).not.toHaveBeenCalled();
  });

  it("no-ops when the feature flag is off", async () => {
    mocks.flagOn.value = false;
    await onTaskDone("t1");
    expect(mocks.prisma.task.findUnique).not.toHaveBeenCalled();
    expect(mocks.grantXp).not.toHaveBeenCalled();
  });
});

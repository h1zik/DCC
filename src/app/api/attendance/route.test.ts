import { AttendanceType } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    attendance: {
      findFirst: mocks.findFirst,
      update: mocks.update,
    },
  },
}));
vi.mock("@/lib/gamification", () => ({
  evaluateAchievements: vi.fn(),
  isProfileGamificationEnabled: vi.fn(),
  onVerifiedCheckIn: vi.fn(),
}));

import { PATCH } from "./route";

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/attendance", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ id: "record-1", items: [] }));

    expect(response.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("only looks up an editable record owned by the current user", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.findFirst.mockResolvedValue(null);

    const response = await PATCH(
      patchRequest({ id: "record-other", items: ["Keterangan"] }),
    );

    expect(response.status).toBe(404);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        id: "record-other",
        userId: "user-1",
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        type: {
          in: [AttendanceType.CHECK_IN, AttendanceType.CHECK_OUT],
        },
      },
      select: { id: true, type: true },
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("updates only todoList for a check-in", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.findFirst.mockResolvedValue({
      id: "check-in-1",
      type: AttendanceType.CHECK_IN,
    });
    mocks.update.mockResolvedValue({ id: "check-in-1" });

    const response = await PATCH(
      patchRequest({ id: "check-in-1", items: ["  Riset pasar  "] }),
    );

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "check-in-1" },
      data: { todoList: JSON.stringify(["Riset pasar"]) },
    });
  });

  it("clears completedTasks for a check-out when all items are empty", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.findFirst.mockResolvedValue({
      id: "check-out-1",
      type: AttendanceType.CHECK_OUT,
    });
    mocks.update.mockResolvedValue({ id: "check-out-1" });

    const response = await PATCH(
      patchRequest({ id: "check-out-1", items: ["  "] }),
    );

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "check-out-1" },
      data: { completedTasks: null },
    });
  });
});

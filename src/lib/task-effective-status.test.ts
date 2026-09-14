import { describe, expect, it } from "vitest";
import { TaskStatus } from "@prisma/client";
import {
  effectiveTaskStatus,
  isTaskLate,
  taskLateDays,
  toJakartaDayKey,
} from "./task-effective-status";

// 2026-09-14 10:00 WIB (UTC+7) = 03:00 UTC
const NOW = new Date("2026-09-14T03:00:00.000Z");

describe("taskLateDays", () => {
  it("0 bila tanpa tenggat", () => {
    expect(taskLateDays(null, NOW)).toBe(0);
    expect(taskLateDays(undefined, NOW)).toBe(0);
  });

  it("0 bila tenggat hari ini atau masa depan (hari WIB)", () => {
    expect(taskLateDays(new Date("2026-09-14T00:00:00.000Z"), NOW)).toBe(0);
    expect(taskLateDays(new Date("2026-09-20T00:00:00.000Z"), NOW)).toBe(0);
  });

  it("menghitung selisih hari kalender WIB, bukan per-jam", () => {
    // Tenggat 13 Sep 23:00 WIB (16:00 UTC) → 1 hari telat pada 14 Sep pagi.
    expect(taskLateDays(new Date("2026-09-13T16:00:00.000Z"), NOW)).toBe(1);
    expect(taskLateDays(new Date("2026-09-04T00:00:00.000Z"), NOW)).toBe(10);
  });

  it("konsisten dengan isTaskLate & toJakartaDayKey", () => {
    const due = new Date("2026-09-13T16:30:00.000Z"); // 13 Sep 23:30 WIB
    expect(toJakartaDayKey(due)).toBe("2026-09-13");
    expect(isTaskLate(due, NOW)).toBe(true);
    expect(taskLateDays(due, NOW)).toBeGreaterThan(0);
  });
});

describe("effectiveTaskStatus", () => {
  it("TODO/IN_PROGRESS telat → OVERDUE", () => {
    const due = new Date("2026-09-10T00:00:00.000Z");
    expect(effectiveTaskStatus(TaskStatus.TODO, due, NOW)).toBe(TaskStatus.OVERDUE);
    expect(effectiveTaskStatus(TaskStatus.IN_PROGRESS, due, NOW)).toBe(
      TaskStatus.OVERDUE,
    );
  });

  it("DONE tidak pernah dioverlay overdue", () => {
    const due = new Date("2026-09-10T00:00:00.000Z");
    expect(effectiveTaskStatus(TaskStatus.DONE, due, NOW)).toBe(TaskStatus.DONE);
  });
});

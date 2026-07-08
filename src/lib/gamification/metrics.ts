/**
 * Metrik adopsi gamifikasi (untuk memantau "definisi sukses"): apakah adopsi
 * absensi & ketepatan waktu task bergerak. Read-only.
 */
import { prisma } from "@/lib/prisma";
import { jakartaDateString } from "./time";

export type GamificationMetrics = {
  employees: number;
  activeCheckin7d: number;
  activeCheckin28d: number;
  /** 0..1 — employee dengan ≥1 check-in terverifikasi dalam periode. */
  adoption7d: number;
  adoption28d: number;
  tasksDone28d: number;
  tasksOntime28d: number;
  /** 0..1 — task selesai tepat waktu / task selesai bertenggat (28 hari). */
  ontimeRate28d: number;
  avgLevel: number;
  usersWithProgression: number;
  achievementsUnlocked: number;
};

function daysAgoJakarta(days: number): string {
  return jakartaDateString(new Date(Date.now() - days * 86_400_000));
}

export async function getGamificationMetrics(): Promise<GamificationMetrics> {
  const cutoff7 = daysAgoJakarta(7);
  const cutoff28 = daysAgoJakarta(28);
  const since28 = new Date(Date.now() - 28 * 86_400_000);

  const [employees, active7, active28, doneTasks, avg, progCount, achUnlocked] =
    await Promise.all([
      prisma.user.count({ where: { employmentType: "EMPLOYEE" } }),
      prisma.attendance.findMany({
        where: { type: "CHECK_IN", confidence: { gt: 0 }, date: { gte: cutoff7 } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.attendance.findMany({
        where: { type: "CHECK_IN", confidence: { gt: 0 }, date: { gte: cutoff28 } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.task.findMany({
        where: { completedAt: { gte: since28 }, dueDate: { not: null } },
        select: { completedAt: true, dueDate: true },
      }),
      prisma.userProgression.aggregate({ _avg: { level: true } }),
      prisma.userProgression.count(),
      prisma.userAchievement.count({ where: { unlockedAt: { not: null } } }),
    ]);

  const tasksDone28d = doneTasks.length;
  const tasksOntime28d = doneTasks.filter(
    (t) => t.completedAt && t.dueDate && t.completedAt <= t.dueDate,
  ).length;

  return {
    employees,
    activeCheckin7d: active7.length,
    activeCheckin28d: active28.length,
    adoption7d: employees ? active7.length / employees : 0,
    adoption28d: employees ? active28.length / employees : 0,
    tasksDone28d,
    tasksOntime28d,
    ontimeRate28d: tasksDone28d ? tasksOntime28d / tasksDone28d : 0,
    avgLevel: avg._avg.level ?? 0,
    usersWithProgression: progCount,
    achievementsUnlocked: achUnlocked,
  };
}

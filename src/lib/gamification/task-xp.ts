/**
 * XP tugas selesai tepat waktu: dipanggil setelah transisi DONE (yang sudah
 * meng-set Task.completedAt). Membaca completedAt + dueDate, memberi XP ke tiap
 * assignee bila on-time. Idempotent via dedupeKey per (task, user) → reopen→
 * reclose atau evaluasi ganda tak menambah. Overdue-close = 0 (tanpa penalti);
 * TIDAK ada XP untuk membuat/memindah tugas.
 */
import { prisma } from "@/lib/prisma";
import { XP } from "./constants";
import { isProfileGamificationEnabled } from "./flag";
import { grantXp } from "./grant";

/** True bila tugas ditutup ≤ tenggat (dueDate null dianggap on-time). */
export function isTaskOnTime(
  completedAt: Date | null,
  dueDate: Date | null,
): boolean {
  if (!completedAt) return false;
  if (!dueDate) return true;
  return completedAt.getTime() <= dueDate.getTime();
}

export async function onTaskDone(taskId: string): Promise<void> {
  if (!(await isProfileGamificationEnabled())) return;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      completedAt: true,
      dueDate: true,
      assignees: { select: { userId: true } },
    },
  });
  if (!task || !task.completedAt) return;
  if (!isTaskOnTime(task.completedAt, task.dueDate)) return; // overdue = 0 XP

  for (const assignee of task.assignees) {
    await grantXp({
      userId: assignee.userId,
      amount: XP.TASK_ONTIME,
      reason: "TASK_ONTIME",
      dedupeKey: `task_ontime:${taskId}:${assignee.userId}`,
      refType: "task",
      refId: taskId,
    });
  }
}

import { NotificationType, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";

/** Menandai tugas lewat tenggat sebagai OVERDUE dan mengirim notifikasi ke PIC. */
export async function syncOverdueTasks() {
  const now = new Date();
  const candidates = await prisma.task.findMany({
    where: {
      status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
      dueDate: { lte: now },
    },
    include: {
      project: { include: { brand: true, room: { select: { name: true } } } },
    },
  });

  for (const t of candidates) {
    await prisma.task.update({
      where: { id: t.id },
      data: { status: TaskStatus.OVERDUE },
    });
    if (t.assigneeId) {
      await notifyUser(
        t.assigneeId,
        `Tugas overdue: ${t.title} (${taskProjectContextLabel(t.project)})`,
        NotificationType.TASK_OVERDUE,
      );
    }
  }
}

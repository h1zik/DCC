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
      archivedAt: null,
    },
    select: {
      id: true,
      assigneeId: true,
      title: true,
      project: { include: { brand: true, room: { select: { name: true } } } },
    },
  });
  if (candidates.length === 0) return;

  const ids = candidates.map((c) => c.id);
  await prisma.task.updateMany({
    where: { id: { in: ids } },
    data: { status: TaskStatus.OVERDUE },
  });

  await Promise.all(
    candidates
      .filter((c) => c.assigneeId)
      .map((c) =>
        notifyUser(
          c.assigneeId!,
          `Tugas overdue: ${c.title} (${taskProjectContextLabel(c.project)})`,
          NotificationType.TASK_OVERDUE,
        ),
      ),
  );
}

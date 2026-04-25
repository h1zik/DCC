import { NotificationType, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import { notifyPicTaskOverdueViaWhatsApp } from "@/lib/task-whatsapp-notify";

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
      assignees: {
        select: { userId: true, user: { select: { name: true, whatsappPhone: true } } },
      },
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
      .flatMap((c) => c.assignees.map((a) => ({ userId: a.userId, c })))
      .map(({ userId, c }) =>
        notifyUser(
          userId,
          `Tugas overdue: ${c.title} (${taskProjectContextLabel(c.project)})`,
          NotificationType.TASK_OVERDUE,
        ),
      ),
  );

  await Promise.all(
    candidates.flatMap((c) =>
      c.assignees.map((a) =>
        notifyPicTaskOverdueViaWhatsApp({
          assignee: a.user,
          taskTitle: c.title,
          project: c.project,
        }),
      ),
    ),
  );
}

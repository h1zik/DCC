import { NotificationType, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import { statusForColumn } from "@/lib/room-kanban-columns";
import { isTaskLate } from "@/lib/task-effective-status";
import { notifyPicTaskOverdueViaWhatsApp } from "@/lib/task-whatsapp-notify";

/**
 * OVERDUE adalah status TURUNAN dua arah — bukan lajur papan:
 * 1) Task TODO/IN_PROGRESS yang lewat tenggat (hari WIB) → status OVERDUE
 *    + notifikasi PIC. `kanbanColumnId` TIDAK disentuh: kartu tetap di
 *    tahapnya, papan menampilkan badge "Telat" dari deadline.
 * 2) Auto-lepas: task OVERDUE yang tenggatnya diperpanjang/dihapus → status
 *    kembali ke bucket kolomnya (tanpa notifikasi ulang).
 */
export async function syncOverdueTasks() {
  const now = new Date();

  // ── 1) Tandai yang baru lewat tenggat ──
  const candidates = await prisma.task.findMany({
    where: {
      status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
      dueDate: { not: null },
      archivedAt: null,
    },
    select: {
      id: true,
      dueDate: true,
      title: true,
      assignees: {
        select: { userId: true, user: { select: { name: true, whatsappPhone: true } } },
      },
      project: { include: { brand: true, room: { select: { name: true } } } },
    },
  });
  const newlyOverdue = candidates.filter((c) => isTaskLate(c.dueDate, now));

  if (newlyOverdue.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: newlyOverdue.map((c) => c.id) } },
      data: { status: TaskStatus.OVERDUE },
    });

    await Promise.all(
      newlyOverdue
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
      newlyOverdue.flatMap((c) =>
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

  // ── 2) Auto-lepas: OVERDUE yang tidak lagi telat (deadline diundur/dihapus)
  // kembali ke bucket kolomnya. Default IN_PROGRESS bila kolom tak terbaca. ──
  const stillMarked = await prisma.task.findMany({
    where: { status: TaskStatus.OVERDUE, archivedAt: null },
    select: {
      id: true,
      dueDate: true,
      kanbanColumn: {
        select: { kind: true, coreRole: true, linkedStatus: true },
      },
    },
  });

  const releaseIdsByBucket = new Map<TaskStatus, string[]>();
  for (const t of stillMarked) {
    if (isTaskLate(t.dueDate, now)) continue;
    const bucket = t.kanbanColumn
      ? statusForColumn({
          ...t.kanbanColumn,
          // statusForColumn hanya membaca kind/coreRole/linkedStatus.
          id: "",
          title: "",
          sortOrder: 0,
        })
      : TaskStatus.IN_PROGRESS;
    // Jaga-jaga data lama: bucket kolom tak boleh OVERDUE/DONE di jalur lepas.
    const safeBucket =
      bucket === TaskStatus.OVERDUE || bucket === TaskStatus.DONE
        ? TaskStatus.IN_PROGRESS
        : bucket;
    const list = releaseIdsByBucket.get(safeBucket) ?? [];
    list.push(t.id);
    releaseIdsByBucket.set(safeBucket, list);
  }

  for (const [bucket, ids] of releaseIdsByBucket) {
    await prisma.task.updateMany({
      where: { id: { in: ids } },
      data: { status: bucket },
    });
  }
}

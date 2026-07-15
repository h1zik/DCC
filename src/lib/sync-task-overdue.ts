import { NotificationType, TaskStatus, type RoomTaskProcess } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import { statusForColumn } from "@/lib/room-kanban-columns";
import { isTaskLate } from "@/lib/task-effective-status";
import { resolveBoardColumnIdForBucket } from "@/lib/task-kanban-sync";
import { notifyPicTaskOverdueViaWhatsApp } from "@/lib/task-whatsapp-notify";

type TaskBoardRef = {
  roomProcess: RoomTaskProcess;
  customProcessPhaseId: string | null;
  project: { roomId: string };
};

/** Resolver kolom per bucket dengan cache per ruangan+fase (hemat query). */
function makeBoardColumnResolver(bucket: TaskStatus) {
  const cache = new Map<string, string | null>();
  return async function resolve(task: TaskBoardRef): Promise<string | null> {
    const phaseKey = task.customProcessPhaseId ?? `proc:${task.roomProcess}`;
    const cacheKey = `${task.project.roomId}::${phaseKey}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;
    const id = await resolveBoardColumnIdForBucket(
      task.project.roomId,
      task,
      bucket,
    );
    cache.set(cacheKey, id);
    return id;
  };
}

/**
 * Lajur "Overdue" dikelola SISTEM dua arah — `kanbanColumnId` ikut disinkron
 * karena papan menempatkan kartu dari kolom, bukan dari status:
 * 1) Task TODO/IN_PROGRESS lewat tenggat (hari WIB) → status OVERDUE +
 *    kartu pindah ke kolom Overdue + notifikasi PIC.
 * 2) Auto-lepas: task OVERDUE yang tenggatnya diundur ke masa depan →
 *    status IN_PROGRESS + kartu kembali ke kolom "Berjalan" (tanpa
 *    notifikasi ulang). Task OVERDUE tanpa tenggat dibiarkan (penandaan
 *    manual via papan dihormati).
 * 3) Self-heal: task OVERDUE yang kartunya tertinggal di kolom lain
 *    dipindahkan ke kolom Overdue.
 */
export async function syncOverdueTasks() {
  const now = new Date();
  const resolveOverdueColumnId = makeBoardColumnResolver(TaskStatus.OVERDUE);
  const resolveInProgressColumnId = makeBoardColumnResolver(
    TaskStatus.IN_PROGRESS,
  );

  // ── 1) Tandai yang baru lewat tenggat → OVERDUE + pindah kolom ──
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
      roomProcess: true,
      customProcessPhaseId: true,
      assignees: {
        select: { userId: true, user: { select: { name: true, whatsappPhone: true } } },
      },
      project: {
        include: { brand: true, room: { select: { id: true, name: true } } },
      },
    },
  });
  const newlyOverdue = candidates.filter((c) => isTaskLate(c.dueDate, now));

  if (newlyOverdue.length > 0) {
    // Kelompokkan per kolom target → satu updateMany per kolom (hemat query).
    const taskIdsByTargetColumn = new Map<string | null, string[]>();
    for (const c of newlyOverdue) {
      const columnId = await resolveOverdueColumnId({
        roomProcess: c.roomProcess,
        customProcessPhaseId: c.customProcessPhaseId,
        project: { roomId: c.project.room.id },
      });
      const bucket = taskIdsByTargetColumn.get(columnId) ?? [];
      bucket.push(c.id);
      taskIdsByTargetColumn.set(columnId, bucket);
    }

    for (const [columnId, taskIds] of taskIdsByTargetColumn) {
      await prisma.task.updateMany({
        where: { id: { in: taskIds } },
        // columnId null (papan tanpa kolom Overdue): biarkan kolom apa adanya;
        // repairOrphanTaskKanbanColumnIds memposisikan ulang saat papan dibuka.
        data: {
          status: TaskStatus.OVERDUE,
          ...(columnId ? { kanbanColumnId: columnId } : {}),
        },
      });
    }

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

  // ── 2 & 3) Task berstatus OVERDUE: lepas yang tenggatnya sudah diundur,
  // rapikan kartu yang belum di kolom Overdue. ──
  const marked = await prisma.task.findMany({
    where: { status: TaskStatus.OVERDUE, archivedAt: null },
    select: {
      id: true,
      dueDate: true,
      kanbanColumnId: true,
      roomProcess: true,
      customProcessPhaseId: true,
      kanbanColumn: {
        select: { kind: true, coreRole: true, linkedStatus: true },
      },
      project: { select: { roomId: true } },
    },
  });

  const releaseIds: string[] = [];
  const releaseColumnByTask = new Map<string, string | null>();
  const healIdsByColumn = new Map<string, string[]>();

  for (const t of marked) {
    const boardRef = {
      roomProcess: t.roomProcess,
      customProcessPhaseId: t.customProcessPhaseId,
      project: { roomId: t.project.roomId },
    };
    const stillLate = isTaskLate(t.dueDate, now);
    const inOverdueLane =
      t.kanbanColumn != null &&
      statusForColumn({
        ...t.kanbanColumn,
        id: "",
        title: "",
        sortOrder: 0,
      }) === TaskStatus.OVERDUE;

    if (!stillLate && t.dueDate != null) {
      // Auto-lepas: tenggat baru di masa depan → kembali ke "Berjalan".
      releaseIds.push(t.id);
      releaseColumnByTask.set(
        t.id,
        inOverdueLane || !t.kanbanColumn
          ? await resolveInProgressColumnId(boardRef)
          : null, // kartu sudah di kolom kerja lain — biarkan di sana
      );
      continue;
    }

    if (stillLate && !inOverdueLane) {
      // Self-heal: kartu telat tertinggal di kolom lain → pindah ke lajur.
      const target = await resolveOverdueColumnId(boardRef);
      if (!target || t.kanbanColumnId === target) continue;
      const bucket = healIdsByColumn.get(target) ?? [];
      bucket.push(t.id);
      healIdsByColumn.set(target, bucket);
    }
  }

  for (const id of releaseIds) {
    const columnId = releaseColumnByTask.get(id) ?? null;
    await prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.IN_PROGRESS,
        ...(columnId ? { kanbanColumnId: columnId } : {}),
      },
    });
  }

  for (const [columnId, taskIds] of healIdsByColumn) {
    await prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: { kanbanColumnId: columnId },
    });
  }
}

import { NotificationType, RoomTaskProcess, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import { notifyPicTaskOverdueViaWhatsApp } from "@/lib/task-whatsapp-notify";

const JAKARTA_TZ = "Asia/Jakarta";

function toJakartaDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/**
 * Selesaikan id kolom "Overdue" untuk papan sebuah tugas (ruangan + fase).
 * `kanbanColumnId` WAJIB ikut di-set saat status berubah: papan Kanban
 * menentukan posisi kartu dari `kanbanColumnId`, bukan dari `status` saja.
 * Tanpa ini, status berubah OVERDUE tetapi kartu tetap menempel di kolom lama.
 * Mengembalikan `null` bila papan tidak punya kolom Overdue.
 */
function makeOverdueColumnResolver() {
  // Cache per ruangan+fase agar tidak query berulang dalam satu sinkronisasi.
  const cache = new Map<string, string | null>();
  return async function resolveOverdueColumnId(task: {
    roomProcess: RoomTaskProcess;
    customProcessPhaseId: string | null;
    project: { roomId: string };
  }): Promise<string | null> {
    const phaseKey = task.customProcessPhaseId ?? `proc:${task.roomProcess}`;
    const cacheKey = `${task.project.roomId}::${phaseKey}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;
    const column = await prisma.roomKanbanColumn.findFirst({
      where: {
        roomId: task.project.roomId,
        customProcessPhaseId: task.customProcessPhaseId,
        roomProcess: task.customProcessPhaseId ? null : task.roomProcess,
        OR: [
          { coreRole: TaskStatus.OVERDUE },
          { linkedStatus: TaskStatus.OVERDUE },
        ],
      },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
      select: { id: true },
    });
    const id = column?.id ?? null;
    cache.set(cacheKey, id);
    return id;
  };
}

/** Menandai tugas lewat tenggat sebagai OVERDUE dan mengirim notifikasi ke PIC. */
export async function syncOverdueTasks() {
  const now = new Date();
  const todayJakarta = toJakartaDayKey(now);
  const resolveOverdueColumnId = makeOverdueColumnResolver();

  // ── 1) Tandai tugas yang baru melewati tenggat → OVERDUE + pindah kolom ──
  const candidates = await prisma.task.findMany({
    where: {
      status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
      dueDate: { not: null },
      archivedAt: null,
    },
    select: {
      id: true,
      dueDate: true,
      roomProcess: true,
      customProcessPhaseId: true,
      kanbanColumnId: true,
      assignees: {
        select: { userId: true, user: { select: { name: true, whatsappPhone: true } } },
      },
      title: true,
      project: { include: { brand: true, room: { select: { name: true } } } },
    },
  });
  const overdueCandidates = candidates.filter((c) => {
    if (!c.dueDate) return false;
    // Aturan bisnis: due 27 Apr baru overdue saat sudah masuk 28 Apr (WIB).
    return toJakartaDayKey(c.dueDate) < todayJakarta;
  });

  if (overdueCandidates.length > 0) {
    // Kelompokkan per kolom target → satu updateMany per kolom (hemat query).
    const taskIdsByTargetColumn = new Map<string | null, string[]>();
    for (const c of overdueCandidates) {
      const columnId = await resolveOverdueColumnId(c);
      const bucket = taskIdsByTargetColumn.get(columnId) ?? [];
      bucket.push(c.id);
      taskIdsByTargetColumn.set(columnId, bucket);
    }

    for (const [columnId, taskIds] of taskIdsByTargetColumn) {
      await prisma.task.updateMany({
        where: { id: { in: taskIds } },
        // columnId === null (papan tanpa kolom Overdue): kosongkan
        // `kanbanColumnId` agar papan memposisikan ulang via status saat
        // dibuka (repairOrphanTaskKanbanColumnIds).
        data: { status: TaskStatus.OVERDUE, kanbanColumnId: columnId },
      });
    }

    await Promise.all(
      overdueCandidates
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
      overdueCandidates.flatMap((c) =>
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

  // ── 2) Self-heal: tugas yang sudah OVERDUE tetapi kartunya masih menempel di
  // kolom non-Overdue (akibat bug lama yang hanya mengubah status). Pindahkan
  // kartu ke kolom Overdue tanpa mengirim notifikasi ulang. ──
  const alreadyOverdue = await prisma.task.findMany({
    where: { status: TaskStatus.OVERDUE, archivedAt: null },
    select: {
      id: true,
      kanbanColumnId: true,
      roomProcess: true,
      customProcessPhaseId: true,
      project: { select: { roomId: true } },
    },
  });

  const fixIdsByColumn = new Map<string, string[]>();
  for (const t of alreadyOverdue) {
    const target = await resolveOverdueColumnId(t);
    // Tidak ada kolom Overdue di papan → biarkan apa adanya.
    if (!target || t.kanbanColumnId === target) continue;
    const bucket = fixIdsByColumn.get(target) ?? [];
    bucket.push(t.id);
    fixIdsByColumn.set(target, bucket);
  }

  for (const [columnId, taskIds] of fixIdsByColumn) {
    await prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: { kanbanColumnId: columnId },
    });
  }
}

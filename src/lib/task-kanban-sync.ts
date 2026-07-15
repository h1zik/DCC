import { TaskStatus, type RoomTaskProcess } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Helper sinkronisasi Tahap (kolom Kanban) ↔ Kategori (`Task.status`).
 * Dipakai server actions (`actions/tasks.ts`) dan agent (`lib/agent/mutations.ts`)
 * agar semua jalur tulis memakai aturan resolusi kolom yang sama.
 */

/** Bucket status sebuah kolom (CORE → coreRole; CUSTOM → linkedStatus). */
export function kanbanColumnBucket(col: {
  kind: string;
  coreRole: TaskStatus | null;
  linkedStatus: TaskStatus;
}): TaskStatus {
  return col.kind === "CORE" && col.coreRole ? col.coreRole : col.linkedStatus;
}

/** Filter kolom papan sesuai fase task (fase kustom vs papan legacy/simple hub). */
export function taskBoardColumnWhere(task: {
  roomProcess: RoomTaskProcess;
  customProcessPhaseId: string | null;
}) {
  // PENTING: saat fase kustom, JANGAN ikut memfilter `roomProcess` — kolom
  // CORE tersimpan dengan roomProcess null tetapi kolom CUSTOM di fase bawaan
  // menyimpan legacy key, jadi filter roomProcess membuat kolom custom tak
  // pernah ketemu (bug lama: pindah status ke kolom custom selalu gagal).
  return task.customProcessPhaseId
    ? { customProcessPhaseId: task.customProcessPhaseId }
    : { customProcessPhaseId: null, roomProcess: task.roomProcess };
}

/**
 * Kolom papan untuk sebuah bucket status (kolom CORE diprioritaskan).
 * `null` bila papan belum pernah di-seed — biarkan; `repairOrphanTaskKanbanColumnIds`
 * menautkan kartu saat papan dirender.
 */
export async function resolveBoardColumnIdForBucket(
  roomId: string,
  task: { roomProcess: RoomTaskProcess; customProcessPhaseId: string | null },
  bucket: TaskStatus,
): Promise<string | null> {
  const column = await prisma.roomKanbanColumn.findFirst({
    where: {
      roomId,
      ...taskBoardColumnWhere(task),
      OR: [{ coreRole: bucket }, { linkedStatus: bucket }],
    },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
    select: { id: true },
  });
  return column?.id ?? null;
}

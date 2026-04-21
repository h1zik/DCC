"use server";

import { RoomTaskProcess, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomHubManager } from "@/lib/room-access";
import { ensureDefaultRoomKanbanColumns } from "@/lib/room-kanban-columns";
import {
  isDefaultKanbanLinkedStatus,
  taskStatusLabel,
} from "@/lib/task-status-ui";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { revalidatePath } from "next/cache";

const titleSchema = z.string().trim().min(1).max(80);

export async function updateRoomKanbanColumnTitle(input: {
  columnId: string;
  title: string;
}) {
  const session = await requireTasksRoomHubSession();
  const title = titleSchema.parse(input.title);
  const col = await prisma.roomKanbanColumn.findUniqueOrThrow({
    where: { id: input.columnId },
    select: { roomId: true },
  });
  await assertRoomHubManager(col.roomId, session.user.id);
  await prisma.roomKanbanColumn.update({
    where: { id: input.columnId },
    data: { title },
  });
  revalidateTasksAndRoomHub();
  revalidatePath("/tasks");
}

const reorderSchema = z.object({
  roomId: z.string().min(1),
  roomProcess: z.nativeEnum(RoomTaskProcess),
  orderedColumnIds: z.array(z.string().min(1)).min(1),
});

export async function reorderRoomKanbanColumns(
  input: z.infer<typeof reorderSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = reorderSchema.parse(input);
  await assertRoomHubManager(data.roomId, session.user.id);
  await ensureDefaultRoomKanbanColumns(data.roomId, data.roomProcess);

  const cols = await prisma.roomKanbanColumn.findMany({
    where: { roomId: data.roomId, roomProcess: data.roomProcess },
    select: { id: true },
  });
  const valid = new Set(cols.map((c) => c.id));
  if (data.orderedColumnIds.some((id) => !valid.has(id))) {
    throw new Error("Urutan kolom tidak valid.");
  }

  await prisma.$transaction(
    data.orderedColumnIds.map((id, i) =>
      prisma.roomKanbanColumn.update({
        where: { id },
        data: { sortOrder: i },
      }),
    ),
  );
  revalidateTasksAndRoomHub();
  revalidatePath("/tasks");
}

const addSchema = z.object({
  roomId: z.string().min(1),
  roomProcess: z.nativeEnum(RoomTaskProcess),
  linkedStatus: z.nativeEnum(TaskStatus),
});

/** Tambah kolom untuk status yang belum punya kolom di papan ini. */
export async function addRoomKanbanColumn(input: z.infer<typeof addSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = addSchema.parse(input);
  await assertRoomHubManager(data.roomId, session.user.id);
  await ensureDefaultRoomKanbanColumns(data.roomId, data.roomProcess);

  const existing = await prisma.roomKanbanColumn.findUnique({
    where: {
      roomId_roomProcess_linkedStatus: {
        roomId: data.roomId,
        roomProcess: data.roomProcess,
        linkedStatus: data.linkedStatus,
      },
    },
  });
  if (existing) {
    throw new Error("Kolom untuk status ini sudah ada.");
  }

  const max = await prisma.roomKanbanColumn.aggregate({
    where: { roomId: data.roomId, roomProcess: data.roomProcess },
    _max: { sortOrder: true },
  });
  await prisma.roomKanbanColumn.create({
    data: {
      roomId: data.roomId,
      roomProcess: data.roomProcess,
      linkedStatus: data.linkedStatus,
      title: taskStatusLabel(data.linkedStatus),
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidateTasksAndRoomHub();
  revalidatePath("/tasks");
}

const deleteColumnSchema = z.object({
  columnId: z.string().min(1),
});

/**
 * Hapus kolom untuk status tambahan (bukan To‑Do / Berjalan / Overdue / Selesai).
 * Jika masih ada tugas aktif (belum diarsip) dengan status tersebut di fase ini, penghapusan ditolak.
 */
export async function deleteRoomKanbanColumn(
  input: z.infer<typeof deleteColumnSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const { columnId } = deleteColumnSchema.parse(input);
  const col = await prisma.roomKanbanColumn.findUniqueOrThrow({
    where: { id: columnId },
    select: {
      id: true,
      roomId: true,
      roomProcess: true,
      linkedStatus: true,
    },
  });
  await assertRoomHubManager(col.roomId, session.user.id);

  if (isDefaultKanbanLinkedStatus(col.linkedStatus)) {
    throw new Error(
      "Kolom untuk status utama (To-Do, Berjalan, Overdue, Selesai) tidak dapat dihapus.",
    );
  }

  const activeTasks = await prisma.task.count({
    where: {
      status: col.linkedStatus,
      roomProcess: col.roomProcess,
      project: { roomId: col.roomId },
      archivedAt: null,
    },
  });
  if (activeTasks > 0) {
    throw new Error(
      `Masih ada ${activeTasks} tugas aktif dengan status "${taskStatusLabel(col.linkedStatus)}" di fase ini. Ubah status atau arsipkan tugas selesai dulu, lalu coba hapus kolom lagi.`,
    );
  }

  await prisma.roomKanbanColumn.delete({ where: { id: col.id } });
  revalidateTasksAndRoomHub();
  revalidatePath("/tasks");
}

/** Status yang belum punya kolom di papan (untuk dropdown “tambah kolom”). */
export async function listUnusedKanbanStatuses(input: {
  roomId: string;
  roomProcess: RoomTaskProcess;
}): Promise<TaskStatus[]> {
  const session = await requireTasksRoomHubSession();
  await assertRoomHubManager(input.roomId, session.user.id);
  await ensureDefaultRoomKanbanColumns(input.roomId, input.roomProcess);
  const cols = await prisma.roomKanbanColumn.findMany({
    where: { roomId: input.roomId, roomProcess: input.roomProcess },
    select: { linkedStatus: true },
  });
  const used = new Set(cols.map((c) => c.linkedStatus));
  return (Object.values(TaskStatus) as TaskStatus[]).filter((s) => !used.has(s));
}

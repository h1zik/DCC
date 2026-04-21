import { RoomTaskProcess, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_KANBAN_STATUSES, taskStatusLabel } from "@/lib/task-status-ui";

export type RoomKanbanColumnDTO = {
  id: string;
  linkedStatus: TaskStatus;
  title: string;
  sortOrder: number;
};

/** Pastikan empat kolom default ada untuk kombinasi ruangan + fase. */
export async function ensureDefaultRoomKanbanColumns(
  roomId: string,
  roomProcess: RoomTaskProcess,
): Promise<void> {
  const count = await prisma.roomKanbanColumn.count({
    where: { roomId, roomProcess },
  });
  if (count > 0) return;

  await prisma.roomKanbanColumn.createMany({
    data: DEFAULT_KANBAN_STATUSES.map((linkedStatus, i) => ({
      roomId,
      roomProcess,
      linkedStatus,
      title: taskStatusLabel(linkedStatus),
      sortOrder: i,
    })),
  });
}

export async function getRoomKanbanColumns(
  roomId: string,
  roomProcess: RoomTaskProcess,
): Promise<RoomKanbanColumnDTO[]> {
  await ensureDefaultRoomKanbanColumns(roomId, roomProcess);
  const rows = await prisma.roomKanbanColumn.findMany({
    where: { roomId, roomProcess },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      linkedStatus: true,
      title: true,
      sortOrder: true,
    },
  });
  return rows;
}

import { RoomTaskProcess, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RoomProcessPhaseRef } from "@/lib/room-process-phase";
import { DEFAULT_KANBAN_STATUSES, taskStatusLabel } from "@/lib/task-status-ui";

export type RoomKanbanColumnDTO = {
  id: string;
  linkedStatus: TaskStatus;
  title: string;
  sortOrder: number;
};

/** Kolom Kanban ruangan HQ/Team (tanpa fase proses). */
export async function ensureSimpleHubKanbanColumns(
  roomId: string,
): Promise<void> {
  const roomProcess = RoomTaskProcess.MARKET_RESEARCH;
  const count = await prisma.roomKanbanColumn.count({
    where: { roomId, roomProcess, customProcessPhaseId: null },
  });
  if (count > 0) return;

  await prisma.roomKanbanColumn.createMany({
    data: DEFAULT_KANBAN_STATUSES.map((linkedStatus, i) => ({
      roomId,
      roomProcess,
      customProcessPhaseId: null,
      linkedStatus,
      title: taskStatusLabel(linkedStatus),
      sortOrder: i,
    })),
  });
}

export async function getSimpleHubKanbanColumns(
  roomId: string,
): Promise<RoomKanbanColumnDTO[]> {
  await ensureSimpleHubKanbanColumns(roomId);
  return prisma.roomKanbanColumn.findMany({
    where: {
      roomId,
      roomProcess: RoomTaskProcess.MARKET_RESEARCH,
      customProcessPhaseId: null,
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      linkedStatus: true,
      title: true,
      sortOrder: true,
    },
  });
}

/** Pastikan kolom default untuk fase proses ruangan. */
export async function ensureDefaultRoomKanbanColumnsForCustomPhase(
  roomId: string,
  customProcessPhaseId: string,
): Promise<void> {
  const count = await prisma.roomKanbanColumn.count({
    where: { roomId, customProcessPhaseId },
  });
  if (count > 0) return;

  await prisma.roomKanbanColumn.createMany({
    data: DEFAULT_KANBAN_STATUSES.map((linkedStatus, i) => ({
      roomId,
      roomProcess: null,
      customProcessPhaseId,
      linkedStatus,
      title: taskStatusLabel(linkedStatus),
      sortOrder: i,
    })),
  });
}

export async function getRoomKanbanColumns(
  roomId: string,
  phase: RoomProcessPhaseRef,
): Promise<RoomKanbanColumnDTO[]> {
  await ensureDefaultRoomKanbanColumnsForCustomPhase(roomId, phase.id);

  const rows = await prisma.roomKanbanColumn.findMany({
    where: { roomId, customProcessPhaseId: phase.id },
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

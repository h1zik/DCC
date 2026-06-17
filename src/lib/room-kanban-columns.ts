import { KanbanColumnKind, RoomTaskProcess, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RoomProcessPhaseRef } from "@/lib/room-process-phase";
import { DEFAULT_KANBAN_STATUSES, taskStatusLabel } from "@/lib/task-status-ui";

export type RoomKanbanColumnDTO = {
  id: string;
  kind: KanbanColumnKind;
  coreRole: TaskStatus | null;
  linkedStatus: TaskStatus;
  title: string;
  sortOrder: number;
};

const columnSelect = {
  id: true,
  kind: true,
  coreRole: true,
  linkedStatus: true,
  title: true,
  sortOrder: true,
} as const;

/** Perbaiki kolom custom yang salah ditandai CORE (mis. setelah migrate). */
export async function repairDuplicateCoreKanbanColumns(where: {
  roomId: string;
  roomProcess?: RoomTaskProcess | null;
  customProcessPhaseId?: string | null;
}): Promise<void> {
  const cols = await prisma.roomKanbanColumn.findMany({
    where: {
      roomId: where.roomId,
      ...(where.customProcessPhaseId != null
        ? { customProcessPhaseId: where.customProcessPhaseId }
        : {
            customProcessPhaseId: null,
            roomProcess: where.roomProcess ?? undefined,
          }),
      kind: KanbanColumnKind.CORE,
      coreRole: { not: null },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, coreRole: true },
  });

  const seen = new Set<TaskStatus>();
  for (const col of cols) {
    if (!col.coreRole || seen.has(col.coreRole)) {
      await prisma.roomKanbanColumn.update({
        where: { id: col.id },
        data: { kind: KanbanColumnKind.CUSTOM, coreRole: null },
      });
      continue;
    }
    seen.add(col.coreRole);
  }
}

async function seedCoreColumns(
  roomId: string,
  roomProcess: RoomTaskProcess | null,
  customProcessPhaseId: string | null,
): Promise<void> {
  for (let i = 0; i < DEFAULT_KANBAN_STATUSES.length; i++) {
    const coreRole = DEFAULT_KANBAN_STATUSES[i]!;
    const existing = await prisma.roomKanbanColumn.findFirst({
      where: {
        roomId,
        roomProcess: customProcessPhaseId ? null : roomProcess ?? undefined,
        customProcessPhaseId,
        coreRole,
      },
    });
    if (existing) continue;

    await prisma.roomKanbanColumn.create({
      data: {
        roomId,
        roomProcess: customProcessPhaseId ? null : roomProcess,
        customProcessPhaseId,
        kind: "CORE",
        coreRole,
        linkedStatus: coreRole,
        title: taskStatusLabel(coreRole),
        sortOrder: i,
      },
    });
  }
}

/** Kolom Kanban ruangan HQ/Team (tanpa fase proses). */
export async function ensureSimpleHubKanbanColumns(
  roomId: string,
): Promise<void> {
  const roomProcess = RoomTaskProcess.MARKET_RESEARCH;
  await seedCoreColumns(roomId, roomProcess, null);
}

export async function getSimpleHubKanbanColumns(
  roomId: string,
): Promise<RoomKanbanColumnDTO[]> {
  await ensureSimpleHubKanbanColumns(roomId);
  await repairDuplicateCoreKanbanColumns({
    roomId,
    roomProcess: RoomTaskProcess.MARKET_RESEARCH,
    customProcessPhaseId: null,
  });
  return prisma.roomKanbanColumn.findMany({
    where: {
      roomId,
      roomProcess: RoomTaskProcess.MARKET_RESEARCH,
      customProcessPhaseId: null,
    },
    orderBy: { sortOrder: "asc" },
    select: columnSelect,
  });
}

/** Pastikan kolom default untuk fase proses ruangan. */
export async function ensureDefaultRoomKanbanColumnsForCustomPhase(
  roomId: string,
  customProcessPhaseId: string,
): Promise<void> {
  await seedCoreColumns(roomId, null, customProcessPhaseId);
}

export async function getRoomKanbanColumns(
  roomId: string,
  phase: RoomProcessPhaseRef,
): Promise<RoomKanbanColumnDTO[]> {
  await ensureDefaultRoomKanbanColumnsForCustomPhase(roomId, phase.id);
  await repairDuplicateCoreKanbanColumns({
    roomId,
    roomProcess: phase.legacyProcessKey ?? null,
    customProcessPhaseId: phase.id,
  });

  return prisma.roomKanbanColumn.findMany({
    where: { roomId, customProcessPhaseId: phase.id },
    orderBy: { sortOrder: "asc" },
    select: columnSelect,
  });
}

/** Resolve column for task when `kanbanColumnId` belum terisi (safety net). */
export function resolveColumnIdForTask(
  task: {
    status: TaskStatus;
    kanbanColumnId?: string | null;
  },
  columns: RoomKanbanColumnDTO[],
): string | null {
  if (task.kanbanColumnId) return task.kanbanColumnId;
  const core = columns.find(
    (c) => c.kind === "CORE" && c.coreRole === task.status,
  );
  if (core) return core.id;
  const byLinked = columns.find((c) => c.linkedStatus === task.status);
  return byLinked?.id ?? columns[0]?.id ?? null;
}

export function statusForColumn(column: RoomKanbanColumnDTO): TaskStatus {
  if (column.kind === "CORE" && column.coreRole) return column.coreRole;
  return column.linkedStatus;
}

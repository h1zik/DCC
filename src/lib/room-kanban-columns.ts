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
  colorHex?: string | null;
};

export const KANBAN_COLUMN_COLOR_PRESETS = [
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#F43F5E",
  "#F59E0B",
  "#10B981",
  "#06B6D4",
  "#64748B",
] as const;

export const DEFAULT_KANBAN_COLUMN_COLOR = KANBAN_COLUMN_COLOR_PRESETS[0];

const columnSelect = {
  id: true,
  kind: true,
  coreRole: true,
  linkedStatus: true,
  title: true,
  sortOrder: true,
  colorHex: true,
} as const;

export type KanbanColumnAccent = {
  colorHex: string | null;
  dotClassName: string;
  ringClassName: string;
};

export function kanbanColumnAccent(
  column: Pick<
    RoomKanbanColumnDTO,
    "kind" | "coreRole" | "linkedStatus" | "colorHex"
  >,
): KanbanColumnAccent {
  if (column.colorHex) {
    return {
      colorHex: column.colorHex,
      dotClassName: "",
      ringClassName: "ring-black/10 dark:ring-white/20",
    };
  }
  const status = statusForColumn(column as RoomKanbanColumnDTO);
  switch (status) {
    case TaskStatus.TODO:
      return {
        colorHex: null,
        dotClassName: "bg-slate-400",
        ringClassName: "ring-slate-300/40",
      };
    case TaskStatus.IN_PROGRESS:
      return {
        colorHex: null,
        dotClassName: "bg-amber-500",
        ringClassName: "ring-amber-300/40",
      };
    case TaskStatus.IN_REVIEW:
      return {
        colorHex: null,
        dotClassName: "bg-violet-500",
        ringClassName: "ring-violet-300/40",
      };
    case TaskStatus.OVERDUE:
      return {
        colorHex: null,
        dotClassName: "bg-rose-500",
        ringClassName: "ring-rose-300/40",
      };
    case TaskStatus.DONE:
      return {
        colorHex: null,
        dotClassName: "bg-emerald-500",
        ringClassName: "ring-emerald-300/40",
      };
    default:
      return {
        colorHex: null,
        dotClassName: "bg-muted-foreground",
        ringClassName: "ring-muted-foreground/30",
      };
  }
}

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
  const columns = await prisma.roomKanbanColumn.findMany({
    where: {
      roomId,
      roomProcess: RoomTaskProcess.MARKET_RESEARCH,
      customProcessPhaseId: null,
    },
    orderBy: { sortOrder: "asc" },
    select: columnSelect,
  });
  await repairOrphanTaskKanbanColumnIds(roomId, columns, { simpleHub: true });
  return columns;
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

  const columns = await prisma.roomKanbanColumn.findMany({
    where: { roomId, customProcessPhaseId: phase.id },
    orderBy: { sortOrder: "asc" },
    select: columnSelect,
  });
  await repairOrphanTaskKanbanColumnIds(roomId, columns, {
    customProcessPhaseId: phase.id,
  });
  return columns;
}
export function resolveColumnIdForTask(
  task: {
    status: TaskStatus;
    kanbanColumnId?: string | null;
  },
  columns: RoomKanbanColumnDTO[],
): string | null {
  if (task.kanbanColumnId) {
    const onBoard = columns.find((c) => c.id === task.kanbanColumnId);
    if (onBoard) return task.kanbanColumnId;
  }
  const core = columns.find(
    (c) => c.kind === "CORE" && c.coreRole === task.status,
  );
  if (core) return core.id;
  const byLinked = columns.find((c) => c.linkedStatus === task.status);
  return byLinked?.id ?? columns[0]?.id ?? null;
}

/** Perbaiki task yang `kanbanColumnId`-nya tidak cocok dengan kolom papan aktif. */
export async function repairOrphanTaskKanbanColumnIds(
  roomId: string,
  columns: RoomKanbanColumnDTO[],
  phaseFilter?: {
    customProcessPhaseId?: string | null;
    roomProcess?: RoomTaskProcess;
    /** Ruangan tanpa brand: perbaiki semua task di ruangan, tanpa filter fase. */
    simpleHub?: boolean;
  },
): Promise<void> {
  if (columns.length === 0) return;
  const validIds = columns.map((c) => c.id);
  const phaseWhere = phaseFilter?.simpleHub
    ? {}
    : phaseFilter?.customProcessPhaseId
      ? { customProcessPhaseId: phaseFilter.customProcessPhaseId }
      : {
          customProcessPhaseId: null,
          ...(phaseFilter?.roomProcess
            ? { roomProcess: phaseFilter.roomProcess }
            : {}),
        };
  const orphans = await prisma.task.findMany({
    where: {
      project: { roomId },
      archivedAt: null,
      ...phaseWhere,
      OR: [
        { kanbanColumnId: null },
        ...(validIds.length > 0
          ? [{ kanbanColumnId: { notIn: validIds } }]
          : []),
      ],
    },
    select: {
      id: true,
      status: true,
      kanbanColumnId: true,
    },
  });
  for (const task of orphans) {
    const columnId = resolveColumnIdForTask(task, columns);
    if (!columnId || columnId === task.kanbanColumnId) continue;
    await prisma.task.update({
      where: { id: task.id },
      data: { kanbanColumnId: columnId },
    });
  }
}

export function statusForColumn(column: RoomKanbanColumnDTO): TaskStatus {
  if (column.kind === "CORE" && column.coreRole) return column.coreRole;
  return column.linkedStatus;
}

/** Gabungkan kolom server dengan kolom lokal yang belum ada di server (mis. baru ditambah). */
export function mergeKanbanColumns(
  server: RoomKanbanColumnDTO[],
  local: RoomKanbanColumnDTO[],
): RoomKanbanColumnDTO[] {
  const serverIds = new Set(server.map((c) => c.id));
  const serverHasRealColumns = server.some((c) => !c.id.startsWith("fallback-"));
  const localIsFallbackOnly =
    local.length > 0 && local.every((c) => c.id.startsWith("fallback-"));

  if (localIsFallbackOnly && serverHasRealColumns) {
    return server;
  }

  const localHasReal = local.some((c) => !c.id.startsWith("fallback-"));
  if (localHasReal && serverHasRealColumns) {
    const sharesColumnId = local.some((c) => serverIds.has(c.id));
    if (!sharesColumnId) {
      return server;
    }
  }

  const extras = local.filter((c) => {
    if (serverIds.has(c.id)) return false;
    if (serverHasRealColumns && c.id.startsWith("fallback-")) return false;
    return true;
  });

  return extras.length === 0 ? server : [...server, ...extras];
}

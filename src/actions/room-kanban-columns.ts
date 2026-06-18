"use server";

import { KanbanColumnKind, RoomTaskProcess, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomHubManager } from "@/lib/room-access";
import {
  ensureDefaultRoomKanbanColumnsForCustomPhase,
  ensureSimpleHubKanbanColumns,
  getRoomKanbanColumns,
  repairDuplicateCoreKanbanColumns,
} from "@/lib/room-kanban-columns";
import {
  kanbanColumnWhere,
  resolveRoomProcessPhaseKey,
} from "@/lib/room-kanban-phase-key";
import {
  isDefaultKanbanLinkedStatus,
  taskStatusLabel,
} from "@/lib/task-status-ui";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { revalidatePath } from "next/cache";

const titleSchema = z.string().trim().min(1).max(80);

const colorHexSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Warna tidak valid.")
  .optional()
  .nullable();

export async function updateRoomKanbanColumn(input: {
  columnId: string;
  title?: string;
  colorHex?: string | null;
}) {
  const session = await requireTasksRoomHubSession();
  if (input.title === undefined && input.colorHex === undefined) {
    throw new Error("Tidak ada perubahan untuk disimpan.");
  }
  const col = await prisma.roomKanbanColumn.findUniqueOrThrow({
    where: { id: input.columnId },
    select: { roomId: true },
  });
  await assertRoomHubManager(col.roomId, session.user.id);
  const data: { title?: string; colorHex?: string | null } = {};
  if (input.title !== undefined) {
    data.title = titleSchema.parse(input.title);
  }
  if (input.colorHex !== undefined) {
    data.colorHex =
      input.colorHex === null ? null : colorHexSchema.parse(input.colorHex);
  }
  await prisma.roomKanbanColumn.update({
    where: { id: input.columnId },
    data,
  });
  revalidateTasksAndRoomHub();
  revalidatePath("/tasks");
}

export async function updateRoomKanbanColumnTitle(input: {
  columnId: string;
  title: string;
}) {
  return updateRoomKanbanColumn({
    columnId: input.columnId,
    title: input.title,
  });
}

const reorderSchema = z.object({
  roomId: z.string().min(1),
  processKey: z.string().min(1),
  orderedColumnIds: z.array(z.string().min(1)).min(1),
});

export async function reorderRoomKanbanColumns(
  input: z.infer<typeof reorderSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = reorderSchema.parse(input);
  await assertRoomHubManager(data.roomId, session.user.id);
  const phase = await resolveRoomProcessPhaseKey(data.roomId, data.processKey);
  await ensureDefaultRoomKanbanColumnsForCustomPhase(data.roomId, phase.id);

  const cols = await prisma.roomKanbanColumn.findMany({
    where: kanbanColumnWhere(data.roomId, phase),
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

const addCustomSchema = z.object({
  roomId: z.string().min(1),
  processKey: z.string().min(1),
  title: titleSchema,
  colorHex: colorHexSchema.optional(),
  workflowBucket: z
    .enum([
      TaskStatus.IN_PROGRESS,
      TaskStatus.IN_REVIEW,
      TaskStatus.BLOCKED,
    ])
    .default(TaskStatus.IN_PROGRESS),
});

/** Tambah kolom custom bebas nama. */
export async function addCustomKanbanColumn(
  input: z.infer<typeof addCustomSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = addCustomSchema.parse(input);
  await assertRoomHubManager(data.roomId, session.user.id);
  const phase = await resolveRoomProcessPhaseKey(data.roomId, data.processKey);
  await ensureDefaultRoomKanbanColumnsForCustomPhase(data.roomId, phase.id);
  const colorHex =
    data.colorHex === undefined || data.colorHex === null
      ? null
      : colorHexSchema.parse(data.colorHex);

  const where = kanbanColumnWhere(data.roomId, phase);
  const count = await prisma.roomKanbanColumn.count({ where });
  if (count >= 20) {
    throw new Error("Maksimal 20 kolom per papan.");
  }

  const max = await prisma.roomKanbanColumn.aggregate({
    where,
    _max: { sortOrder: true },
  });

  const col = await prisma.roomKanbanColumn.create({
    data: {
      roomId: data.roomId,
      roomProcess: phase.legacyProcessKey ?? null,
      customProcessPhaseId: phase.id,
      kind: KanbanColumnKind.CUSTOM,
      coreRole: null,
      linkedStatus: data.workflowBucket,
      title: data.title,
      colorHex,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    select: {
      id: true,
      title: true,
      sortOrder: true,
      linkedStatus: true,
      colorHex: true,
    },
  });
  revalidateTasksAndRoomHub();
  revalidatePath("/tasks");
  return col;
}

const addSchema = z.object({
  roomId: z.string().min(1),
  processKey: z.string().min(1),
  linkedStatus: z.nativeEnum(TaskStatus),
  title: titleSchema.optional(),
});

/** Tambah kolom untuk status opsional (BLOCKED / IN_REVIEW) atau custom title. */
export async function addRoomKanbanColumn(input: z.infer<typeof addSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = addSchema.parse(input);
  await assertRoomHubManager(data.roomId, session.user.id);
  const phase = await resolveRoomProcessPhaseKey(data.roomId, data.processKey);
  await ensureDefaultRoomKanbanColumnsForCustomPhase(data.roomId, phase.id);

  if (isDefaultKanbanLinkedStatus(data.linkedStatus)) {
    throw new Error("Kolom inti sudah ada di papan.");
  }

  const where = kanbanColumnWhere(data.roomId, phase);
  const existing = await prisma.roomKanbanColumn.findFirst({
    where: {
      ...where,
      linkedStatus: data.linkedStatus,
      kind: KanbanColumnKind.CUSTOM,
      title: data.title ?? taskStatusLabel(data.linkedStatus),
    },
  });
  if (existing) {
    throw new Error("Kolom serupa sudah ada.");
  }

  const max = await prisma.roomKanbanColumn.aggregate({
    where,
    _max: { sortOrder: true },
  });
  await prisma.roomKanbanColumn.create({
    data: {
      roomId: data.roomId,
      roomProcess: phase.legacyProcessKey ?? null,
      customProcessPhaseId: phase.id,
      kind: KanbanColumnKind.CUSTOM,
      coreRole: null,
      linkedStatus: data.linkedStatus,
      title: data.title ?? taskStatusLabel(data.linkedStatus),
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidateTasksAndRoomHub();
  revalidatePath("/tasks");
}

const deleteColumnSchema = z.object({
  columnId: z.string().min(1),
});

/** Hapus kolom CUSTOM hanya jika tidak ada tugas. */
export async function deleteCustomKanbanColumn(
  input: z.infer<typeof deleteColumnSchema>,
) {
  return deleteRoomKanbanColumn(input);
}

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
      customProcessPhaseId: true,
      kind: true,
      coreRole: true,
      linkedStatus: true,
      title: true,
    },
  });
  await assertRoomHubManager(col.roomId, session.user.id);

  await repairDuplicateCoreKanbanColumns({
    roomId: col.roomId,
    roomProcess: col.customProcessPhaseId ? null : col.roomProcess,
    customProcessPhaseId: col.customProcessPhaseId,
  });

  const fresh = await prisma.roomKanbanColumn.findUniqueOrThrow({
    where: { id: columnId },
    select: { kind: true, title: true },
  });

  if (fresh.kind === KanbanColumnKind.CORE) {
    throw new Error(
      "Kolom inti (To-Do, Berjalan, Overdue, Selesai) tidak dapat dihapus.",
    );
  }

  const taskCount = await prisma.task.count({
    where: { kanbanColumnId: columnId, archivedAt: null },
  });
  if (taskCount > 0) {
    throw new Error(
      `Masih ada ${taskCount} tugas di kolom "${fresh.title}". Pindahkan tugas dulu sebelum menghapus kolom.`,
    );
  }

  await prisma.roomKanbanColumn.delete({ where: { id: col.id } });
  revalidateTasksAndRoomHub();
  revalidatePath("/tasks");
}

/** Status yang belum punya kolom CUSTOM di papan (untuk dropdown legacy). */
export async function listUnusedKanbanStatuses(input: {
  roomId: string;
  processKey: string;
}): Promise<TaskStatus[]> {
  const session = await requireTasksRoomHubSession();
  await assertRoomHubManager(input.roomId, session.user.id);
  const phase = await resolveRoomProcessPhaseKey(input.roomId, input.processKey);
  await getRoomKanbanColumns(input.roomId, phase);
  const cols = await prisma.roomKanbanColumn.findMany({
    where: kanbanColumnWhere(input.roomId, phase),
    select: { linkedStatus: true },
  });
  const used = new Set(cols.map((c) => c.linkedStatus));
  return (Object.values(TaskStatus) as TaskStatus[]).filter(
    (s) => !used.has(s) && !isDefaultKanbanLinkedStatus(s),
  );
}

/** Simple hub: reorder kolom tanpa processKey. */
export async function reorderSimpleHubKanbanColumns(input: {
  roomId: string;
  orderedColumnIds: string[];
}) {
  const session = await requireTasksRoomHubSession();
  await assertRoomHubManager(input.roomId, session.user.id);
  const cols = await prisma.roomKanbanColumn.findMany({
    where: {
      roomId: input.roomId,
      roomProcess: RoomTaskProcess.MARKET_RESEARCH,
      customProcessPhaseId: null,
    },
    select: { id: true },
  });
  const valid = new Set(cols.map((c) => c.id));
  if (input.orderedColumnIds.some((id) => !valid.has(id))) {
    throw new Error("Urutan kolom tidak valid.");
  }
  await prisma.$transaction(
    input.orderedColumnIds.map((id, i) =>
      prisma.roomKanbanColumn.update({
        where: { id },
        data: { sortOrder: i },
      }),
    ),
  );
  revalidateTasksAndRoomHub();
  revalidatePath("/tasks");
}

/** Tambah kolom custom di ruangan HQ/Team (tanpa fase proses / tanpa brand). */
export async function addSimpleHubCustomKanbanColumn(input: {
  roomId: string;
  title: string;
  colorHex?: string | null;
  workflowBucket?: typeof TaskStatus.IN_PROGRESS | typeof TaskStatus.IN_REVIEW | typeof TaskStatus.BLOCKED;
}) {
  const session = await requireTasksRoomHubSession();
  const title = titleSchema.parse(input.title);
  const colorHex =
    input.colorHex === undefined || input.colorHex === null
      ? null
      : colorHexSchema.parse(input.colorHex);
  const workflowBucket = input.workflowBucket ?? TaskStatus.IN_PROGRESS;
  await assertRoomHubManager(input.roomId, session.user.id);
  await ensureSimpleHubKanbanColumns(input.roomId);

  const where = {
    roomId: input.roomId,
    roomProcess: RoomTaskProcess.MARKET_RESEARCH,
    customProcessPhaseId: null,
  };
  const count = await prisma.roomKanbanColumn.count({ where });
  if (count >= 20) {
    throw new Error("Maksimal 20 kolom per papan.");
  }

  const max = await prisma.roomKanbanColumn.aggregate({
    where,
    _max: { sortOrder: true },
  });

  const col = await prisma.roomKanbanColumn.create({
    data: {
      roomId: input.roomId,
      roomProcess: RoomTaskProcess.MARKET_RESEARCH,
      customProcessPhaseId: null,
      kind: KanbanColumnKind.CUSTOM,
      coreRole: null,
      linkedStatus: workflowBucket,
      title,
      colorHex,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    select: {
      id: true,
      title: true,
      sortOrder: true,
      linkedStatus: true,
      colorHex: true,
    },
  });
  revalidateTasksAndRoomHub();
  revalidatePath("/tasks");
  return col;
}

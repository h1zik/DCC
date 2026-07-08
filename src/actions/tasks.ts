"use server";

import { revalidatePath } from "next/cache";
import {
  ContentPlanJenis,
  NotificationType,
  type Prisma,
  RoomMemberRole,
  RoomTaskProcess,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { isProfileGamificationEnabled, onTaskDone } from "@/lib/gamification";
import { notifyCeo, notifyTaskCompletedForCeo } from "@/lib/notify";
import {
  notifyPicTaskViaWhatsApp,
  notifyRoomManagersTaskDoneViaWhatsApp,
} from "@/lib/task-whatsapp-notify";
import { recomputeProjectProgress } from "@/lib/project-progress";
import {
  revalidateRoomWorkspace,
  revalidateTasksAndRoomHub,
} from "@/lib/revalidate-workspace";
import {
  isSimpleHubRoom,
  taskProjectContextLabel,
} from "@/lib/room-simple-hub";
import {
  phaseRef,
  taskBelongsToPhase,
  taskPhaseWhere,
  taskToPhaseRef,
  type RoomProcessPhaseRef,
} from "@/lib/room-process-phase";
import { ensureRoomProcessPhases } from "@/lib/room-process-phases-seed";
import {
  assertRoomHubManager,
  assertRoomMember,
  assertRoomMemberHasTaskPhase,
  getProjectRoomId,
  getTaskRoomContext,
  isRoomHubManagerRole,
  memberHasRoomPhaseAccess,
  memberHasRoomProcessAccess,
  roomMemberToProcessAccess,
} from "@/lib/room-access";
import { syncContentPlanRowFromCompletedKanbanTask } from "@/actions/room-content-planning";

const moveSchema = z.object({
  taskId: z.string().min(1),
  status: z.nativeEnum(TaskStatus),
  /** Urutan penuh kolom tujuan setelah drop (opsional). */
  orderedTaskIdsInTarget: z.array(z.string().min(1)).optional(),
});

const moveToColumnSchema = z.object({
  taskId: z.string().min(1),
  columnId: z.string().min(1),
  orderedTaskIdsInTarget: z.array(z.string().min(1)).optional(),
});

const reorderKanbanColumnSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  columnId: z.string().min(1).optional(),
  orderedTaskIds: z.array(z.string().min(1)),
});

async function persistKanbanColumnOrderByColumnId(
  columnId: string,
  orderedTaskIds: string[],
) {
  if (orderedTaskIds.length === 0) return;
  await prisma.$transaction(
    orderedTaskIds.map((taskId, index) =>
      prisma.taskKanbanPosition.upsert({
        where: { taskId_columnId: { taskId, columnId } },
        create: { taskId, columnId, sortKey: index * 1000 },
        update: { sortKey: index * 1000 },
      }),
    ),
  );
}

async function resolveColumnIdForTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<string> {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: {
      kanbanColumnId: true,
      roomProcess: true,
      customProcessPhaseId: true,
      project: { select: { roomId: true } },
    },
  });
  if (task.kanbanColumnId) {
    const col = await prisma.roomKanbanColumn.findUnique({
      where: { id: task.kanbanColumnId },
      select: { linkedStatus: true, coreRole: true, kind: true },
    });
    if (col) {
      const colStatus =
        col.kind === "CORE" && col.coreRole ? col.coreRole : col.linkedStatus;
      if (colStatus === status) return task.kanbanColumnId;
    }
  }
  const column = await prisma.roomKanbanColumn.findFirst({
    where: {
      roomId: task.project.roomId,
      customProcessPhaseId: task.customProcessPhaseId,
      roomProcess: task.customProcessPhaseId ? null : task.roomProcess,
      OR: [{ coreRole: status }, { linkedStatus: status }],
    },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
  });
  if (!column) {
    throw new Error("Kolom Kanban untuk status ini tidak ditemukan.");
  }
  return column.id;
}

async function assertKanbanReorderTasksByColumn(
  roomId: string,
  phase: RoomProcessPhaseRef,
  columnId: string,
  orderedTaskIds: string[],
  userId: string,
) {
  const simpleHub = await isSimpleHubRoom(roomId);
  if (simpleHub) {
    await assertRoomMember(roomId, userId);
  } else {
    await assertRoomMemberHasTaskPhase(roomId, userId, phase);
  }

  const unique = [...new Set(orderedTaskIds)];
  if (unique.length !== orderedTaskIds.length) {
    throw new Error("Daftar urutan tugas tidak valid.");
  }

  const rows = await prisma.task.findMany({
    where: {
      id: { in: orderedTaskIds },
      kanbanColumnId: columnId,
      project: { roomId },
      archivedAt: null,
    },
    select: {
      id: true,
      roomProcess: true,
      customProcessPhaseId: true,
    },
  });
  if (rows.length !== orderedTaskIds.length) {
    throw new Error("Sebagian tugas tidak valid untuk pengurutan kolom ini.");
  }

  if (!simpleHub) {
    const rowById = new Map(rows.map((row) => [row.id, row]));
    for (const taskId of orderedTaskIds) {
      const row = rowById.get(taskId);
      if (!row || !taskBelongsToPhase(row, phase)) {
        throw new Error("Sebagian tugas tidak valid untuk pengurutan kolom ini.");
      }
    }
  }
}

async function assertKanbanReorderTasks(
  roomId: string,
  phase: RoomProcessPhaseRef,
  status: TaskStatus,
  orderedTaskIds: string[],
  userId: string,
) {
  const simpleHub = await isSimpleHubRoom(roomId);
  if (simpleHub) {
    await assertRoomMember(roomId, userId);
  } else {
    await assertRoomMemberHasTaskPhase(roomId, userId, phase);
  }

  const unique = [...new Set(orderedTaskIds)];
  if (unique.length !== orderedTaskIds.length) {
    throw new Error("Daftar urutan tugas tidak valid.");
  }

  const rows = await prisma.task.findMany({
    where: {
      id: { in: orderedTaskIds },
      status,
      project: { roomId },
      archivedAt: null,
    },
    select: {
      id: true,
      roomProcess: true,
      customProcessPhaseId: true,
    },
  });
  if (rows.length !== orderedTaskIds.length) {
    throw new Error("Sebagian tugas tidak valid untuk pengurutan kolom ini.");
  }

  if (!simpleHub) {
    const rowById = new Map(rows.map((row) => [row.id, row]));
    for (const taskId of orderedTaskIds) {
      const row = rowById.get(taskId);
      if (!row || !taskBelongsToPhase(row, phase)) {
        throw new Error("Sebagian tugas tidak valid untuk pengurutan kolom ini.");
      }
    }
  }
}

async function markContentPlanDesignPublishedIfTaskDone(params: {
  roomId: string;
  taskId: string;
  contentPlanItemId: string | null;
  contentPlanJenis: ContentPlanJenis | null;
}) {
  const { roomId, taskId, contentPlanItemId, contentPlanJenis } = params;
  if (!contentPlanItemId || !contentPlanJenis) return;

  await syncContentPlanRowFromCompletedKanbanTask({
    roomId,
    itemId: contentPlanItemId,
    taskId,
    jenisKonten: contentPlanJenis,
  });
}

async function validateAssigneesForRoom(params: {
  roomId: string;
  assigneeIds: string[];
  phase: RoomProcessPhaseRef;
  simpleHub: boolean;
}) {
  const { roomId, assigneeIds, phase, simpleHub } = params;
  if (assigneeIds.length === 0) return;

  const members = await prisma.roomMember.findMany({
    where: { roomId, userId: { in: assigneeIds } },
    select: {
      userId: true,
      role: true,
      allowedRoomProcesses: true,
      allowedCustomProcessPhaseIds: true,
    },
  });
  const memberByUserId = new Map(members.map((m) => [m.userId, m]));

  for (const assigneeId of assigneeIds) {
    const member = memberByUserId.get(assigneeId);
    if (!member) {
      throw new Error("PIC harus berupa anggota ruangan ini.");
    }
    if (
      !simpleHub &&
      !memberHasRoomPhaseAccess(roomMemberToProcessAccess(member), phase)
    ) {
      throw new Error("PIC tidak memiliki akses ke fase proses tugas ini.");
    }
  }
}

async function resolveTaskPhaseForCreate(
  roomId: string,
  data: {
    roomProcess?: RoomTaskProcess;
    customProcessPhaseId?: string | null;
  },
): Promise<{
  phase: RoomProcessPhaseRef;
  roomProcess: RoomTaskProcess;
  customProcessPhaseId: string | null;
}> {
  const phases = await ensureRoomProcessPhases(roomId);
  const phaseId = data.customProcessPhaseId?.trim();
  if (phaseId) {
    const row = phases.find((p) => p.id === phaseId);
    if (!row) {
      throw new Error("Fase proses tidak ditemukan di ruangan ini.");
    }
    return {
      phase: phaseRef(row),
      roomProcess: row.legacyProcessKey ?? RoomTaskProcess.MARKET_RESEARCH,
      customProcessPhaseId: row.id,
    };
  }
  const legacy = data.roomProcess ?? RoomTaskProcess.MARKET_RESEARCH;
  const row =
    phases.find((p) => p.legacyProcessKey === legacy) ?? phases[0];
  if (!row) {
    throw new Error("Belum ada fase proses di ruangan ini.");
  }
  return {
    phase: phaseRef(row),
    roomProcess: row.legacyProcessKey ?? legacy,
    customProcessPhaseId: row.id,
  };
}

export async function reorderKanbanColumn(
  input: z.infer<typeof reorderKanbanColumnSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = reorderKanbanColumnSchema.parse(input);
  if (!data.columnId && !data.status) {
    throw new Error("columnId atau status wajib diisi.");
  }
  const first = await prisma.task.findFirstOrThrow({
    where: { id: data.orderedTaskIds[0] },
    select: { id: true },
  });
  const { roomId, phase } = await getTaskRoomContext(first.id);

  const columnId =
    data.columnId ??
    (await resolveColumnIdForTaskStatus(first.id, data.status!));

  if (data.status) {
    await assertKanbanReorderTasks(
      roomId,
      phase,
      data.status,
      data.orderedTaskIds,
      session.user.id,
    );
  } else {
    await assertKanbanReorderTasksByColumn(
      roomId,
      phase,
      columnId,
      data.orderedTaskIds,
      session.user.id,
    );
  }
  await persistKanbanColumnOrderByColumnId(columnId, data.orderedTaskIds);
  revalidateTasksAndRoomHub();
}

export async function moveTaskToColumn(
  input: z.infer<typeof moveToColumnSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const { taskId, columnId, orderedTaskIdsInTarget } =
    moveToColumnSchema.parse(input);
  const { roomId, phase } = await getTaskRoomContext(taskId);
  await assertRoomMemberHasTaskPhase(roomId, session.user.id, phase);

  const column = await prisma.roomKanbanColumn.findUniqueOrThrow({
    where: { id: columnId },
    select: {
      id: true,
      roomId: true,
      roomProcess: true,
      customProcessPhaseId: true,
      kind: true,
      coreRole: true,
      linkedStatus: true,
    },
  });
  if (column.roomId !== roomId) {
    throw new Error("Kolom tidak valid untuk ruangan ini.");
  }

  const simpleHub = await isSimpleHubRoom(roomId);
  if (simpleHub) {
    if (
      column.customProcessPhaseId !== null ||
      column.roomProcess !== RoomTaskProcess.MARKET_RESEARCH
    ) {
      throw new Error("Kolom tidak valid untuk papan tugas ruangan ini.");
    }
  } else if (column.customProcessPhaseId !== phase.id) {
    throw new Error("Kolom tidak valid untuk fase proses ini.");
  }

  const status =
    column.kind === "CORE" && column.coreRole
      ? column.coreRole
      : column.linkedStatus;

  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      title: true,
      status: true,
      contentPlanItemId: true,
      contentPlanJenis: true,
      isApprovalRequired: true,
      isApproved: true,
      archivedAt: true,
      project: {
        include: { brand: true, room: { select: { name: true, id: true } } },
      },
      assignees: {
        take: 1,
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (task.archivedAt) {
    throw new Error(
      "Tugas diarsipkan. Buka tampilan Arsip dan pulihkan tugas ini untuk mengubah status.",
    );
  }

  if (status === TaskStatus.DONE && task.isApprovalRequired && !task.isApproved) {
    throw new Error(
      "Tugas ini memerlukan persetujuan CEO sebelum ditandai selesai.",
    );
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      kanbanColumnId: columnId,
      status,
      ...(status === TaskStatus.DONE && task.status !== TaskStatus.DONE
        ? {
            completedAt: new Date(),
            whatsappReminder3dSentAt: null,
            whatsappReminder1dSentAt: null,
          }
        : {}),
    },
  });

  // Gamifikasi: XP tugas selesai tepat waktu (first close, fire-and-forget).
  if (
    (await isProfileGamificationEnabled()) &&
    status === TaskStatus.DONE &&
    task.status !== TaskStatus.DONE
  ) {
    void onTaskDone(taskId);
  }

  if (orderedTaskIdsInTarget && orderedTaskIdsInTarget.length > 0) {
    await assertKanbanReorderTasksByColumn(
      roomId,
      phase,
      columnId,
      orderedTaskIdsInTarget,
      session.user.id,
    );
    await persistKanbanColumnOrderByColumnId(
      columnId,
      orderedTaskIdsInTarget,
    );
  }

  if (status === TaskStatus.DONE && task.status !== TaskStatus.DONE) {
    await markContentPlanDesignPublishedIfTaskDone({
      roomId: task.project.room.id,
      taskId: task.id,
      contentPlanItemId: task.contentPlanItemId,
      contentPlanJenis: task.contentPlanJenis,
    });
  }

  const notificationJobs: Promise<unknown>[] = [];
  if (status === TaskStatus.DONE && task.status !== TaskStatus.DONE) {
    notificationJobs.push(
      notifyTaskCompletedForCeo(
        task.title,
        taskProjectContextLabel(task.project),
      ),
    );
    notificationJobs.push(
      notifyRoomManagersTaskDoneViaWhatsApp({
        roomId: task.project.roomId,
        roomProcess:
          phase.legacyProcessKey ?? RoomTaskProcess.MARKET_RESEARCH,
        taskTitle: task.title,
        project: task.project,
        picDisplayName: task.assignees[0]?.user?.name ?? null,
      }),
    );
  }

  if (task.status !== status) {
    void recomputeProjectProgress(task.projectId);
  }

  await Promise.all(notificationJobs);
  revalidateTasksAndRoomHub();
}

export async function moveTaskStatus(input: z.infer<typeof moveSchema>) {
  const session = await requireTasksRoomHubSession();
  const { taskId, status, orderedTaskIdsInTarget } = moveSchema.parse(input);
  const { roomId, phase } = await getTaskRoomContext(taskId);
  await assertRoomMemberHasTaskPhase(roomId, session.user.id, phase);

  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      title: true,
      status: true,
      contentPlanItemId: true,
      contentPlanJenis: true,
      isApprovalRequired: true,
      isApproved: true,
      archivedAt: true,
      project: {
        include: { brand: true, room: { select: { name: true, id: true } } },
      },
      assignees: {
        take: 1,
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (task.archivedAt) {
    throw new Error(
      "Tugas diarsipkan. Buka tampilan Arsip dan pulihkan tugas ini untuk mengubah status.",
    );
  }

  if (status === TaskStatus.DONE && task.isApprovalRequired && !task.isApproved) {
    throw new Error(
      "Tugas ini memerlukan persetujuan CEO sebelum ditandai selesai.",
    );
  }

  const targetColumnId = await resolveColumnIdForTaskStatus(taskId, status);

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      kanbanColumnId: targetColumnId,
      ...(status === TaskStatus.DONE && task.status !== TaskStatus.DONE
        ? {
            completedAt: new Date(),
            whatsappReminder3dSentAt: null,
            whatsappReminder1dSentAt: null,
          }
        : {}),
    },
  });

  // Gamifikasi: XP tugas selesai tepat waktu (first close, fire-and-forget).
  if (
    (await isProfileGamificationEnabled()) &&
    status === TaskStatus.DONE &&
    task.status !== TaskStatus.DONE
  ) {
    void onTaskDone(taskId);
  }

  if (orderedTaskIdsInTarget && orderedTaskIdsInTarget.length > 0) {
    await assertKanbanReorderTasks(
      roomId,
      phase,
      status,
      orderedTaskIdsInTarget,
      session.user.id,
    );
    await persistKanbanColumnOrderByColumnId(
      targetColumnId,
      orderedTaskIdsInTarget,
    );
  }

  if (status === TaskStatus.DONE && task.status !== TaskStatus.DONE) {
    await markContentPlanDesignPublishedIfTaskDone({
      roomId: task.project.room.id,
      taskId: task.id,
      contentPlanItemId: task.contentPlanItemId,
      contentPlanJenis: task.contentPlanJenis,
    });
  }

  const notificationJobs: Promise<unknown>[] = [];
  if (status === TaskStatus.DONE && task.status !== TaskStatus.DONE) {
    notificationJobs.push(
      notifyTaskCompletedForCeo(
        task.title,
        taskProjectContextLabel(task.project),
      ),
    );
    notificationJobs.push(
      notifyRoomManagersTaskDoneViaWhatsApp({
        roomId: task.project.roomId,
        roomProcess:
          phase.legacyProcessKey ?? RoomTaskProcess.MARKET_RESEARCH,
        taskTitle: task.title,
        project: task.project,
        picDisplayName: task.assignees[0]?.user?.name ?? null,
      }),
    );
  }

  if (task.status !== status) {
    void recomputeProjectProgress(task.projectId);
  }
  revalidateRoomWorkspace(roomId);
  revalidatePath("/projects");
  revalidatePath("/approvals");
  if (notificationJobs.length > 0) {
    void Promise.allSettled(notificationJobs);
  }
}

export async function archiveTask(taskId: string) {
  const session = await requireTasksRoomHubSession();
  const { roomId, phase } = await getTaskRoomContext(taskId);
  const simpleHub = await isSimpleHubRoom(roomId);
  const hubManager = await assertRoomHubManager(roomId, session.user.id);
  if (
    !simpleHub &&
    hubManager.role === RoomMemberRole.ROOM_MANAGER &&
    !memberHasRoomPhaseAccess(roomMemberToProcessAccess(hubManager), phase)
  ) {
    throw new Error("Anda tidak dapat mengarsipkan tugas di fase proses ini.");
  }

  const t = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { status: true, archivedAt: true, projectId: true },
  });
  if (t.status !== TaskStatus.DONE) {
    throw new Error("Hanya tugas berstatus Selesai yang dapat diarsipkan.");
  }
  if (t.archivedAt) {
    throw new Error("Tugas ini sudah diarsipkan.");
  }
  await prisma.task.update({
    where: { id: taskId },
    data: { archivedAt: new Date() },
  });
  void recomputeProjectProgress(t.projectId);
  revalidateRoomWorkspace(roomId);
  revalidatePath("/projects");
}

export async function unarchiveTask(taskId: string) {
  const session = await requireTasksRoomHubSession();
  const { roomId, phase } = await getTaskRoomContext(taskId);
  const simpleHub = await isSimpleHubRoom(roomId);
  const hubManager = await assertRoomHubManager(roomId, session.user.id);
  if (
    !simpleHub &&
    hubManager.role === RoomMemberRole.ROOM_MANAGER &&
    !memberHasRoomPhaseAccess(roomMemberToProcessAccess(hubManager), phase)
  ) {
    throw new Error("Anda tidak dapat memulihkan tugas di fase proses ini.");
  }

  const t = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { archivedAt: true, projectId: true },
  });
  if (!t.archivedAt) {
    throw new Error("Tugas ini tidak dalam arsip.");
  }
  await prisma.task.update({
    where: { id: taskId },
    data: { archivedAt: null },
  });
  void recomputeProjectProgress(t.projectId);
  revalidateRoomWorkspace(roomId);
  revalidatePath("/projects");
}

const createSchema = z
  .object({
    projectId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    assigneeIds: z.array(z.string()).optional(),
    tagIds: z.array(z.string().min(1)).optional(),
    priority: z.nativeEnum(TaskPriority),
    status: z.nativeEnum(TaskStatus).optional(),
    dueDate: z.coerce.date().optional().nullable(),
    isApprovalRequired: z.boolean().optional(),
    vendorId: z.string().optional().nullable(),
    leadTimeDays: z.coerce.number().int().min(0).optional().nullable(),
    roomProcess: z.nativeEnum(RoomTaskProcess).optional(),
    customProcessPhaseId: z.string().min(1).optional().nullable(),
    contentPlanItemId: z.string().min(1).optional().nullable(),
    contentPlanJenis: z.nativeEnum(ContentPlanJenis).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    const hasId = Boolean(val.contentPlanItemId);
    const hasJenis = val.contentPlanJenis != null;
    if (hasId !== hasJenis) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Tautan Content Planning tidak lengkap: isi id baris dan jenis konten, atau kosongkan keduanya.",
        path: hasId ? ["contentPlanJenis"] : ["contentPlanItemId"],
      });
    }
  });

const taskMutationInclude = {
  project: { include: { brand: true, room: { select: { name: true } } } },
  assignees: {
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  },
  vendor: { select: { id: true, name: true } },
  tags: {
    include: {
      tag: {
        select: { id: true, name: true, colorHex: true, roomId: true },
      },
    },
  },
} satisfies Prisma.TaskInclude;

export type TaskMutationResult = Prisma.TaskGetPayload<{
  include: typeof taskMutationInclude;
}>;

export async function createTask(
  input: z.infer<typeof createSchema>,
): Promise<TaskMutationResult> {
  const session = await requireTasksRoomHubSession();
  const data = createSchema.parse(input);
  const roomId = await getProjectRoomId(data.projectId);
  const hubManager = await assertRoomHubManager(roomId, session.user.id);
  const simpleHub = await isSimpleHubRoom(roomId);

  const phaseFields = simpleHub
    ? {
        phase: {
          id: "simple-hub",
          name: "Tasks",
          legacyProcessKey: null,
        },
        roomProcess: RoomTaskProcess.MARKET_RESEARCH,
        customProcessPhaseId: null,
      }
    : await resolveTaskPhaseForCreate(roomId, data);

  if (
    !simpleHub &&
    hubManager.role === RoomMemberRole.ROOM_MANAGER &&
    !memberHasRoomPhaseAccess(
      roomMemberToProcessAccess(hubManager),
      phaseFields.phase,
    )
  ) {
    throw new Error(
      "Anda tidak memiliki akses ke fase proses ini untuk membuat tugas.",
    );
  }

  const assigneeIds = [...new Set(data.assigneeIds ?? [])].filter(Boolean);
  const tagIds = [...new Set(data.tagIds ?? [])].filter(Boolean);

  if (data.contentPlanItemId && data.contentPlanJenis) {
    const row = await prisma.roomContentPlanItem.findFirst({
      where: { id: data.contentPlanItemId, roomId },
      select: { id: true, jenisKonten: true },
    });
    if (!row) {
      throw new Error("Baris Content Planning tidak ditemukan di ruangan ini.");
    }
    if (row.jenisKonten !== data.contentPlanJenis) {
      throw new Error("Jenis konten tidak cocok dengan baris Content Planning.");
    }
  }

  await validateAssigneesForRoom({
    roomId,
    assigneeIds,
    phase: phaseFields.phase,
    simpleHub,
  });
  if (tagIds.length > 0) {
    const validTagCount = await prisma.taskTag.count({
      where: { id: { in: tagIds }, roomId },
    });
    if (validTagCount !== tagIds.length) {
      throw new Error("Sebagian tag tidak valid untuk ruangan ini.");
    }
  }

  const maxSort = await prisma.task.aggregate({
    where: { projectId: data.projectId, ...taskPhaseWhere(phaseFields.phase) },
    _max: { sortOrder: true },
  });

  const task = await prisma.task.create({
    data: {
      projectId: data.projectId,
      roomProcess: phaseFields.roomProcess,
      customProcessPhaseId: phaseFields.customProcessPhaseId,
      title: data.title,
      description: data.description ?? undefined,
      priority: data.priority,
      status: data.status ?? TaskStatus.TODO,
      dueDate: data.dueDate ?? undefined,
      isApprovalRequired: data.isApprovalRequired ?? false,
      vendorId: data.vendorId || undefined,
      leadTimeDays: data.leadTimeDays ?? undefined,
      contentPlanItemId: data.contentPlanItemId ?? undefined,
      contentPlanJenis: data.contentPlanJenis ?? undefined,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      assignees: {
        create: assigneeIds.map((userId) => ({ userId })),
      },
      ...(tagIds.length > 0
        ? {
            tags: {
              create: tagIds.map((tagId) => ({ tagId })),
            },
          }
        : {}),
    },
    include: taskMutationInclude,
  });

  const notificationJobs: Promise<unknown>[] = [];
  if (task.isApprovalRequired && !task.isApproved) {
    notificationJobs.push(
      notifyCeo(
        `Persetujuan diminta: ${task.title} (${taskProjectContextLabel(task.project)})`,
        NotificationType.CEO_APPROVAL_REQUESTED,
      ),
    );
  }

  for (const assigneeId of assigneeIds) {
    notificationJobs.push(
      notifyPicTaskViaWhatsApp({
        assigneeId,
        headline: "new",
        task: {
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate,
        },
        project: task.project,
      }),
    );
  }

  void recomputeProjectProgress(data.projectId);
  revalidateRoomWorkspace(roomId);
  revalidatePath("/projects");
  revalidatePath("/approvals");
  if (notificationJobs.length > 0) {
    void Promise.allSettled(notificationJobs);
  }
  return task;
}

const updateSchema = createSchema.safeExtend({
  taskId: z.string().min(1),
  status: z.nativeEnum(TaskStatus).optional(),
});

export async function updateTask(
  input: z.infer<typeof updateSchema>,
): Promise<TaskMutationResult> {
  const session = await requireTasksRoomHubSession();
  const data = updateSchema.parse(input);
  const prev = await prisma.task.findUniqueOrThrow({
    where: { id: data.taskId },
    select: {
      id: true,
      projectId: true,
      roomProcess: true,
      customProcessPhaseId: true,
      customProcessPhase: { select: { id: true, name: true } },
      status: true,
      contentPlanItemId: true,
      contentPlanJenis: true,
      isApprovalRequired: true,
      isApproved: true,
      assignees: { select: { userId: true } },
      tags: { select: { tagId: true } },
      dueDate: true,
      archivedAt: true,
      project: { select: { roomId: true } },
    },
  });
  const roomId = prev.project.roomId;

  if (
    prev.archivedAt &&
    data.status !== undefined &&
    data.status !== prev.status
  ) {
    throw new Error(
      "Tugas diarsipkan. Pulihkan dari Arsip terlebih dahulu untuk mengubah status.",
    );
  }
  const simpleHub = await isSimpleHubRoom(roomId);
  const membership = await assertRoomMember(roomId, session.user.id);
  const isHubManager = isRoomHubManagerRole(membership.role);

  const prevPhase = taskToPhaseRef(prev);
  await assertRoomMemberHasTaskPhase(roomId, session.user.id, prevPhase);

  if (
    data.status === TaskStatus.DONE &&
    prev.isApprovalRequired &&
    !prev.isApproved
  ) {
    throw new Error("Perlu persetujuan CEO sebelum menandai selesai.");
  }

  let projectId = data.projectId;
  let assigneeIds =
    data.assigneeIds !== undefined
      ? [...new Set(data.assigneeIds)].filter(Boolean)
      : prev.assignees.map((a) => a.userId);
  let tagIds =
    data.tagIds !== undefined
      ? [...new Set(data.tagIds)].filter(Boolean)
      : prev.tags.map((t) => t.tagId);
  let isApprovalRequired = data.isApprovalRequired ?? false;

  let roomProcess = prev.roomProcess;
  let customProcessPhaseId = prev.customProcessPhaseId;
  if (simpleHub) {
    roomProcess = RoomTaskProcess.MARKET_RESEARCH;
    customProcessPhaseId = null;
  }

  if (!isHubManager) {
    projectId = prev.projectId;
    assigneeIds = prev.assignees.map((a) => a.userId);
    tagIds = prev.tags.map((t) => t.tagId);
    isApprovalRequired = prev.isApprovalRequired;
  } else {
    const newProjectRoomId = await getProjectRoomId(projectId);
    if (newProjectRoomId !== roomId) {
      throw new Error("Proyek harus tetap dalam ruangan yang sama.");
    }
    await validateAssigneesForRoom({
      roomId,
      assigneeIds,
      phase: prevPhase,
      simpleHub,
    });
    if (tagIds.length > 0) {
      const validTagCount = await prisma.taskTag.count({
        where: { id: { in: tagIds }, roomId },
      });
      if (validTagCount !== tagIds.length) {
        throw new Error("Sebagian tag tidak valid untuk ruangan ini.");
      }
    }
  }

  const nextDue = data.dueDate ?? null;
  const prevDue = prev.dueDate;
  const dueDateChanged =
    (prevDue?.getTime() ?? null) !== (nextDue?.getTime() ?? null);
  const markingDone =
    data.status === TaskStatus.DONE && prev.status !== TaskStatus.DONE;

  const prevAssigneeIds = prev.assignees.map((a) => a.userId);
  const addedAssigneeIds = assigneeIds.filter((id) => !prevAssigneeIds.includes(id));
  const removedAssigneeIds = prevAssigneeIds.filter(
    (id) => !assigneeIds.includes(id),
  );
  const assigneesChanged =
    addedAssigneeIds.length > 0 || removedAssigneeIds.length > 0;
  const prevTagIds = prev.tags.map((t) => t.tagId);
  const tagsChanged =
    tagIds.length !== prevTagIds.length ||
    tagIds.some((id) => !prevTagIds.includes(id));

  const task = await prisma.task.update({
    where: { id: data.taskId },
    data: {
      projectId,
      roomProcess,
      customProcessPhaseId,
      title: data.title,
      description: data.description ?? null,
      priority: data.priority,
      dueDate: data.dueDate ?? null,
      isApprovalRequired,
      vendorId: data.vendorId || null,
      leadTimeDays: data.leadTimeDays ?? null,
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(dueDateChanged || markingDone
        ? {
            whatsappReminder3dSentAt: null,
            whatsappReminder1dSentAt: null,
          }
        : {}),
      ...(markingDone ? { completedAt: new Date() } : {}),
      ...(assigneesChanged
        ? {
            assignees: {
              deleteMany: {},
              create: assigneeIds.map((userId) => ({ userId })),
            },
          }
        : {}),
      ...(tagsChanged
        ? {
            tags: {
              deleteMany: {},
              create: tagIds.map((tagId) => ({ tagId })),
            },
          }
        : {}),
    },
    include: taskMutationInclude,
  });

  const becameApproval =
    task.isApprovalRequired &&
    !task.isApproved &&
    !prev.isApprovalRequired;

  const notificationJobs: Promise<unknown>[] = [];
  if (becameApproval) {
    notificationJobs.push(
      notifyCeo(
        `Persetujuan diminta: ${task.title} (${taskProjectContextLabel(task.project)})`,
        NotificationType.CEO_APPROVAL_REQUESTED,
      ),
    );
  }

  if (data.status === TaskStatus.DONE && prev.status !== TaskStatus.DONE) {
    // Gamifikasi: XP tugas selesai tepat waktu (first close, fire-and-forget).
    if (await isProfileGamificationEnabled()) void onTaskDone(task.id);
    notificationJobs.push(
      notifyTaskCompletedForCeo(
        task.title,
        taskProjectContextLabel(task.project),
      ),
    );
    notificationJobs.push(
      notifyRoomManagersTaskDoneViaWhatsApp({
        roomId: task.project.roomId,
        roomProcess: task.roomProcess,
        taskTitle: task.title,
        project: task.project,
        picDisplayName: task.assignees[0]?.user?.name ?? null,
      }),
    );
  }

  if (markingDone) {
    await markContentPlanDesignPublishedIfTaskDone({
      roomId,
      taskId: data.taskId,
      contentPlanItemId: prev.contentPlanItemId,
      contentPlanJenis: prev.contentPlanJenis,
    });
  }

  if (isHubManager) {
    for (const assigneeId of addedAssigneeIds) {
      notificationJobs.push(
        notifyPicTaskViaWhatsApp({
          assigneeId,
          headline: prevAssigneeIds.length > 0 ? "pic_changed" : "new",
          task: {
            title: task.title,
            priority: task.priority,
            dueDate: task.dueDate,
          },
          project: task.project,
        }),
      );
    }
  }

  const progressAffected =
    prev.status !== task.status ||
    prev.projectId !== task.projectId ||
    prev.archivedAt !== task.archivedAt;
  if (progressAffected) {
    void Promise.allSettled([
      recomputeProjectProgress(task.projectId),
      ...(prev.projectId !== task.projectId
        ? [recomputeProjectProgress(prev.projectId)]
        : []),
    ]);
  }
  revalidateRoomWorkspace(roomId);
  revalidatePath("/projects");
  revalidatePath("/approvals");
  if (notificationJobs.length > 0) {
    void Promise.allSettled(notificationJobs);
  }
  return task;
}

export async function deleteTask(taskId: string) {
  const session = await requireTasksRoomHubSession();
  const { roomId, phase } = await getTaskRoomContext(taskId);
  const hubManager = await assertRoomHubManager(roomId, session.user.id);
  const simpleHub = await isSimpleHubRoom(roomId);
  if (
    !simpleHub &&
    hubManager.role === RoomMemberRole.ROOM_MANAGER &&
    !memberHasRoomPhaseAccess(roomMemberToProcessAccess(hubManager), phase)
  ) {
    throw new Error(
      "Anda tidak memiliki akses ke fase proses tugas ini untuk menghapusnya.",
    );
  }

  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { projectId: true },
  });
  await prisma.task.delete({ where: { id: taskId } });
  void recomputeProjectProgress(task.projectId);
  revalidateRoomWorkspace(roomId);
  revalidatePath("/projects");
}

const createTaskTagSchema = z.object({
  roomId: z.string().min(1),
  name: z.string().min(1).max(40),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Warna harus format hex #RRGGBB."),
});

export async function createTaskTag(input: z.infer<typeof createTaskTagSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = createTaskTagSchema.parse(input);
  await assertRoomHubManager(data.roomId, session.user.id);

  try {
    const tag = await prisma.taskTag.create({
      data: {
        roomId: data.roomId,
        name: data.name.trim(),
        colorHex: data.colorHex.toUpperCase(),
      },
      select: { id: true, name: true, colorHex: true, roomId: true },
    });
    revalidateRoomWorkspace(data.roomId);
    return tag;
  } catch {
    throw new Error("Nama tag sudah dipakai di ruangan ini.");
  }
}

async function checklistTaskContextOrThrow(checklistItemId: string) {
  const item = await prisma.taskChecklistItem.findUniqueOrThrow({
    where: { id: checklistItemId },
    select: { taskId: true },
  });
  return getTaskRoomContext(item.taskId);
}

export async function addChecklistItem(taskId: string, title: string) {
  const session = await requireTasksRoomHubSession();
  const { roomId, phase } = await getTaskRoomContext(taskId);
  await assertRoomMemberHasTaskPhase(roomId, session.user.id, phase);

  const max = await prisma.taskChecklistItem.aggregate({
    where: { taskId },
    _max: { sortOrder: true },
  });
  await prisma.taskChecklistItem.create({
    data: {
      taskId,
      title,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidateTasksAndRoomHub();
}

export async function toggleChecklistItem(id: string, done: boolean) {
  const session = await requireTasksRoomHubSession();
  const { roomId, phase } = await checklistTaskContextOrThrow(id);
  await assertRoomMemberHasTaskPhase(roomId, session.user.id, phase);

  await prisma.taskChecklistItem.update({
    where: { id },
    data: { done },
  });
  revalidateTasksAndRoomHub();
}

export async function deleteChecklistItem(id: string) {
  const session = await requireTasksRoomHubSession();
  const { roomId, phase } = await checklistTaskContextOrThrow(id);
  await assertRoomMemberHasTaskPhase(roomId, session.user.id, phase);

  await prisma.taskChecklistItem.delete({ where: { id } });
  revalidateTasksAndRoomHub();
}

const updateChecklistTitleSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(500),
});

export async function updateChecklistItemTitle(
  input: z.infer<typeof updateChecklistTitleSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = updateChecklistTitleSchema.parse(input);
  const { roomId, phase } = await checklistTaskContextOrThrow(data.id);
  await assertRoomMemberHasTaskPhase(roomId, session.user.id, phase);

  await prisma.taskChecklistItem.update({
    where: { id: data.id },
    data: { title: data.title },
  });
  revalidateTasksAndRoomHub();
}

/**
 * Lazy-load komentar + lampiran satu tugas. Dipakai detail sheet — daftar
 * tugas (Kanban/list/Gantt) tidak lagi membawa relasi berat ini di SSR.
 */
export async function loadTaskDetail(taskId: string) {
  const session = await requireTasksRoomHubSession();
  const { roomId, phase } = await getTaskRoomContext(taskId);
  await assertRoomMemberHasTaskPhase(roomId, session.user.id, phase);

  const detail = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      comments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { id: true, name: true, email: true } },
        },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          size: true,
          publicPath: true,
          linkUrl: true,
          createdAt: true,
          uploadedBy: { select: { id: true, name: true, email: true } },
          _count: { select: { comments: true } },
          comments: {
            where: { resolvedAt: null, assigneeId: { not: null } },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!detail) {
    throw new Error("Tugas tidak ditemukan.");
  }
  return {
    id: detail.id,
    comments: detail.comments,
    attachments: detail.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      publicPath: a.publicPath,
      linkUrl: a.linkUrl,
      createdAt: a.createdAt,
      uploadedBy: a.uploadedBy,
      commentCount: a._count.comments,
      unresolvedCommentCount: a.comments.length,
    })),
  };
}

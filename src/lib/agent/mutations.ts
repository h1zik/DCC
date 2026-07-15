import {
  RoomMemberRole,
  RoomTaskProcess,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyTaskCompletedForCeo } from "@/lib/notify";
import {
  notifyPicTaskViaWhatsApp,
  notifyRoomManagersTaskDoneViaWhatsApp,
} from "@/lib/task-whatsapp-notify";
import { recomputeProjectProgress } from "@/lib/project-progress";
import { taskProjectContextLabel } from "@/lib/room-simple-hub";
import {
  assertRoomMember,
  assertRoomMemberHasTaskPhase,
  getProjectRoomId,
  getTaskRoomContext,
  isRoomHubManagerRole,
  memberHasRoomPhaseAccess,
  roomMemberToProcessAccess,
} from "@/lib/room-access";
import {
  phaseRef,
  taskPhaseWhere,
  taskToPhaseRef,
  type RoomProcessPhaseRef,
} from "@/lib/room-process-phase";
import { ensureRoomProcessPhases } from "@/lib/room-process-phases-seed";
import { isSimpleHubRoom } from "@/lib/room-simple-hub";
import {
  bucketFromLegacyStatus,
  effectiveTaskStatus,
} from "@/lib/task-effective-status";
import {
  kanbanColumnBucket,
  resolveBoardColumnIdForBucket,
} from "@/lib/task-kanban-sync";
import { syncContentPlanRowFromCompletedKanbanTask } from "@/actions/room-content-planning";
import {
  assertAgentRoomAccess,
  assertAgentRoomManager,
  canSeeAllRooms,
} from "./access";
import {
  buildDeleteConfirmToken,
  deleteConfirmTokenMatches,
  isExplicitDeleteConfirmation,
} from "./confirm-token";
import {
  findAgentTasksForBulkOperation,
  findAgentTasksForMove,
  listAgentRoomMembers,
  listAgentTasks,
  resolveAgentProcessPhase,
  resolveAgentRoom,
  resolveAssigneeIdsByName,
  resolveDefaultProjectForRoom,
} from "./queries";
import {
  formatDeleteConfirmationMessage,
  formatPhaseRequiredForCreateMessage,
} from "./task-disambiguation";
import { parseAgentDueDate } from "./user-context";
import { getUserAccessiblePhasesInRoom } from "./user-access";
import type { AgentUser } from "./types";

async function resolveTaskPhaseForCreate(
  roomId: string,
  customProcessPhaseId?: string | null,
): Promise<{
  phase: RoomProcessPhaseRef;
  roomProcess: RoomTaskProcess;
  customProcessPhaseId: string | null;
}> {
  const phases = await ensureRoomProcessPhases(roomId);
  const phaseId = customProcessPhaseId?.trim();
  if (phaseId) {
    const row = phases.find((p) => p.id === phaseId);
    if (!row) throw new Error("Fase proses tidak ditemukan di ruangan ini.");
    return {
      phase: phaseRef(row),
      roomProcess: row.legacyProcessKey ?? RoomTaskProcess.MARKET_RESEARCH,
      customProcessPhaseId: row.id,
    };
  }
  const row = phases[0];
  if (!row) throw new Error("Belum ada fase proses di ruangan ini.");
  return {
    phase: phaseRef(row),
    roomProcess: row.legacyProcessKey ?? RoomTaskProcess.MARKET_RESEARCH,
    customProcessPhaseId: row.id,
  };
}

export async function agentCreateTask(
  user: AgentUser,
  input: {
    projectId: string;
    title: string;
    description?: string | null;
    priority?: TaskPriority;
    status?: TaskStatus;
    dueDate?: string | null;
    assigneeIds?: string[];
    customProcessPhaseId?: string | null;
  },
) {
  const roomId = await getProjectRoomId(input.projectId);
  await assertAgentRoomManager(user, roomId);

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
    : await resolveTaskPhaseForCreate(roomId, input.customProcessPhaseId);

  if (!canSeeAllRooms(user) && !simpleHub) {
    const member = await prisma.roomMember.findUniqueOrThrow({
      where: { roomId_userId: { roomId, userId: user.id } },
      select: {
        role: true,
        allowedRoomProcesses: true,
        allowedCustomProcessPhaseIds: true,
      },
    });
    if (
      member.role === RoomMemberRole.ROOM_MANAGER &&
      !memberHasRoomPhaseAccess(
        roomMemberToProcessAccess(member),
        phaseFields.phase,
      )
    ) {
      throw new Error(
        "Anda tidak memiliki akses ke fase proses ini untuk membuat tugas.",
      );
    }
  }

  const assigneeIds = [...new Set(input.assigneeIds ?? [])].filter(Boolean);
  if (assigneeIds.length > 0) {
    const members = await prisma.roomMember.findMany({
      where: { roomId, userId: { in: assigneeIds } },
      select: { userId: true },
    });
    if (members.length !== assigneeIds.length) {
      throw new Error("PIC harus berupa anggota ruangan ini.");
    }
  }

  const maxSort = await prisma.task.aggregate({
    where: {
      projectId: input.projectId,
      ...taskPhaseWhere(phaseFields.phase),
    },
    _max: { sortOrder: true },
  });

  // Tahap awal: kolom bucket status; kategori tersimpan = turunan + overlay telat.
  const bucket = bucketFromLegacyStatus(input.status ?? TaskStatus.TODO);
  const dueDate = input.dueDate ? new Date(input.dueDate) : null;
  const kanbanColumnId = await resolveBoardColumnIdForBucket(
    roomId,
    {
      roomProcess: phaseFields.roomProcess,
      customProcessPhaseId: phaseFields.customProcessPhaseId,
    },
    bucket,
  );

  const task = await prisma.task.create({
    data: {
      projectId: input.projectId,
      roomProcess: phaseFields.roomProcess,
      customProcessPhaseId: phaseFields.customProcessPhaseId,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      priority: input.priority ?? TaskPriority.MEDIUM,
      status: effectiveTaskStatus(bucket, dueDate),
      kanbanColumnId: kanbanColumnId ?? undefined,
      dueDate: dueDate ?? undefined,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      assignees:
        assigneeIds.length > 0
          ? { create: assigneeIds.map((userId) => ({ userId })) }
          : undefined,
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      project: {
        select: {
          name: true,
          brand: { select: { name: true } },
          room: { select: { id: true, name: true } },
        },
      },
    },
  });

  for (const assigneeId of assigneeIds) {
    void notifyPicTaskViaWhatsApp({
      assigneeId,
      headline: "new",
      task: {
        title: task.title,
        priority: task.priority,
        dueDate: task.dueDate,
      },
      project: task.project,
    });
  }

  void recomputeProjectProgress(input.projectId);

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    roomId: task.project.room.id,
    roomName: task.project.room.name,
    projectName: task.project.name,
    message: `Tugas "${task.title}" berhasil dibuat.`,
  };
}

/** Buat tugas dari nama ruangan — project & room ID di-resolve otomatis. */
export async function agentCreateTaskInRoom(
  user: AgentUser,
  input: {
    roomNameOrId: string;
    title: string;
    description?: string | null;
    priority?: TaskPriority;
    status?: TaskStatus;
    dueDate?: string | null;
    assigneeNames?: string[];
    assignCurrentUserAsPic?: boolean;
    processPhaseNameOrId?: string | null;
    customProcessPhaseId?: string | null;
  },
) {
  const room = await resolveAgentRoom(user, input.roomNameOrId);
  const project = await resolveDefaultProjectForRoom(user, room.id);

  let customProcessPhaseId: string | null = null;
  let resolvedPhaseName: string | null = null;
  const phaseInput =
    input.processPhaseNameOrId?.trim() || input.customProcessPhaseId?.trim();

  if (phaseInput) {
    const phase = await resolveAgentProcessPhase(user, room.id, phaseInput);
    customProcessPhaseId = phase.id;
    resolvedPhaseName = phase.name;
  } else {
    const accessiblePhases = await getUserAccessiblePhasesInRoom(user, room.id);

    if (accessiblePhases.length === 1) {
      const only = accessiblePhases[0]!;
      if (only.id !== "simple-hub") {
        customProcessPhaseId = only.id;
      }
      resolvedPhaseName = only.name;
    } else if (accessiblePhases.length > 1) {
      throw new Error(
        formatPhaseRequiredForCreateMessage(
          room.name,
          accessiblePhases.map((p) => p.name),
        ),
      );
    }
  }

  const assigneeIds = new Set<string>();
  if (input.assignCurrentUserAsPic) {
    const members = await listAgentRoomMembers(user, room.id);
    if (!members.some((m) => m.id === user.id)) {
      throw new Error(
        "Anda bukan anggota ruangan ini sehingga tidak bisa ditambahkan sebagai PIC.",
      );
    }
    assigneeIds.add(user.id);
  }
  if (input.assigneeNames?.length) {
    for (const id of await resolveAssigneeIdsByName(
      user,
      room.id,
      input.assigneeNames,
    )) {
      assigneeIds.add(id);
    }
  }

  const created = await agentCreateTask(user, {
    projectId: project.id,
    title: input.title,
    description: input.description,
    priority: input.priority,
    status: input.status,
    dueDate: parseAgentDueDate(input.dueDate),
    assigneeIds: assigneeIds.size > 0 ? [...assigneeIds] : undefined,
    customProcessPhaseId,
  });

  return {
    ...created,
    resolvedRoom: room.name,
    resolvedProject: project.name,
    resolvedPhase: resolvedPhaseName,
  };
}

export async function agentUpdateTask(
  user: AgentUser,
  input: {
    taskId: string;
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    status?: TaskStatus;
    dueDate?: string | null;
    assigneeIds?: string[];
    assignCurrentUserAsPic?: boolean;
  },
) {
  const prev = await prisma.task.findUniqueOrThrow({
    where: { id: input.taskId },
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      status: true,
      dueDate: true,
      projectId: true,
      roomProcess: true,
      customProcessPhaseId: true,
      kanbanColumnId: true,
      kanbanColumn: {
        select: { kind: true, coreRole: true, linkedStatus: true },
      },
      customProcessPhase: { select: { id: true, name: true, legacyProcessKey: true } },
      isApprovalRequired: true,
      isApproved: true,
      archivedAt: true,
      contentPlanItemId: true,
      contentPlanJenis: true,
      assignees: { select: { userId: true } },
      project: { select: { roomId: true } },
    },
  });

  const roomId = prev.project.roomId;
  await assertAgentRoomAccess(user, roomId);

  const prevPhase = taskToPhaseRef(prev);
  if (!canSeeAllRooms(user)) {
    await assertRoomMemberHasTaskPhase(roomId, user.id, prevPhase);
  }

  if (prev.archivedAt) {
    throw new Error("Tugas diarsipkan. Pulihkan dulu sebelum mengedit.");
  }

  // Bucket tahapan: perubahan status eksplisit menang; selain itu ikut kolom.
  const currentBucket = prev.kanbanColumn
    ? kanbanColumnBucket(prev.kanbanColumn)
    : null;
  const bucket =
    input.status !== undefined && input.status !== prev.status
      ? bucketFromLegacyStatus(input.status)
      : (currentBucket ?? bucketFromLegacyStatus(prev.status));
  if (
    bucket === TaskStatus.DONE &&
    prev.isApprovalRequired &&
    !prev.isApproved
  ) {
    throw new Error("Tugas ini memerlukan persetujuan CEO sebelum ditandai selesai.");
  }

  const membership = canSeeAllRooms(user)
    ? { role: RoomMemberRole.ROOM_MANAGER }
    : await assertRoomMember(roomId, user.id);
  const isHubManager =
    canSeeAllRooms(user) || isRoomHubManagerRole(membership.role);

  const wantsAssigneeChange =
    input.assignCurrentUserAsPic === true || input.assigneeIds !== undefined;

  if (wantsAssigneeChange && !isHubManager) {
    throw new Error(
      "Hanya Manager ruangan atau Project Manager yang dapat mengubah PIC tugas.",
    );
  }

  let assigneeIds = prev.assignees.map((a) => a.userId);
  if (isHubManager) {
    if (input.assignCurrentUserAsPic) {
      const members = await listAgentRoomMembers(user, roomId);
      if (!members.some((m) => m.id === user.id)) {
        throw new Error("Anda bukan anggota ruangan ini.");
      }
      assigneeIds = [user.id];
    } else if (input.assigneeIds !== undefined) {
      assigneeIds = [...new Set(input.assigneeIds)].filter(Boolean);
      if (assigneeIds.length > 0) {
        const members = await prisma.roomMember.findMany({
          where: { roomId, userId: { in: assigneeIds } },
          select: { userId: true },
        });
        if (members.length !== assigneeIds.length) {
          throw new Error("PIC harus berupa anggota ruangan ini.");
        }
      }
    }
  }

  const nextTitle = input.title?.trim() || prev.title;
  const nextDescription =
    input.description !== undefined
      ? input.description?.trim() || null
      : prev.description;
  const nextPriority = input.priority ?? prev.priority;
  const parsedDue = input.dueDate !== undefined ? parseAgentDueDate(input.dueDate) : null;
  const nextDueDate =
    input.dueDate !== undefined
      ? parsedDue
        ? new Date(parsedDue)
        : null
      : prev.dueDate;

  const prevDue = prev.dueDate;
  const dueDateChanged =
    (prevDue?.getTime() ?? null) !== (nextDueDate?.getTime() ?? null);
  // Kategori final = bucket + overlay telat dari deadline BARU (deadline
  // diundur otomatis melepas OVERDUE tanpa menunggu cron).
  const nextStatus = effectiveTaskStatus(bucket, nextDueDate);
  const nextColumnId =
    currentBucket === bucket
      ? prev.kanbanColumnId
      : ((await resolveBoardColumnIdForBucket(roomId, prev, bucket)) ??
        prev.kanbanColumnId);
  const markingDone =
    nextStatus === TaskStatus.DONE && prev.status !== TaskStatus.DONE;
  const prevAssigneeIds = prev.assignees.map((a) => a.userId);
  const assigneesChanged =
    isHubManager &&
    (assigneeIds.length !== prevAssigneeIds.length ||
      assigneeIds.some((id) => !prevAssigneeIds.includes(id)));
  const addedAssigneeIds = assigneeIds.filter(
    (id) => !prevAssigneeIds.includes(id),
  );

  const updated = await prisma.task.update({
    where: { id: input.taskId },
    data: {
      title: nextTitle,
      description: nextDescription,
      priority: nextPriority,
      status: nextStatus,
      kanbanColumnId: nextColumnId,
      dueDate: nextDueDate,
      ...(dueDateChanged || markingDone
        ? {
            whatsappReminder3dSentAt: null,
            whatsappReminder1dSentAt: null,
          }
        : {}),
      ...(assigneesChanged
        ? {
            assignees: {
              deleteMany: {},
              create: assigneeIds.map((userId) => ({ userId })),
            },
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      customProcessPhase: { select: { name: true } },
      project: {
        select: {
          name: true,
          brand: { select: { name: true } },
          room: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (markingDone) {
    if (prev.contentPlanItemId && prev.contentPlanJenis) {
      await syncContentPlanRowFromCompletedKanbanTask({
        roomId,
        itemId: prev.contentPlanItemId,
        taskId: prev.id,
        jenisKonten: prev.contentPlanJenis,
      });
    }
    void notifyTaskCompletedForCeo(
      updated.title,
      taskProjectContextLabel(updated.project),
    );
  }

  if (assigneesChanged) {
    for (const assigneeId of addedAssigneeIds) {
      void notifyPicTaskViaWhatsApp({
        assigneeId,
        headline: prevAssigneeIds.length > 0 ? "pic_changed" : "new",
        task: {
          title: updated.title,
          priority: updated.priority,
          dueDate: updated.dueDate,
        },
        project: updated.project,
      });
    }
  }

  if (nextStatus !== prev.status) {
    void recomputeProjectProgress(prev.projectId);
  }

  const changed: string[] = [];
  if (input.title !== undefined && input.title.trim() !== prev.title) {
    changed.push("judul");
  }
  if (input.description !== undefined) changed.push("deskripsi");
  if (input.priority !== undefined && input.priority !== prev.priority) {
    changed.push("prioritas");
  }
  if (input.status !== undefined && input.status !== prev.status) {
    changed.push("status");
  }
  if (dueDateChanged) changed.push("deadline");
  if (assigneesChanged) changed.push("PIC");

  return {
    taskId: updated.id,
    title: updated.title,
    status: updated.status,
    priority: updated.priority,
    dueDate: updated.dueDate?.toISOString() ?? null,
    roomId: updated.project.room.id,
    roomName: updated.project.room.name,
    phaseName: updated.customProcessPhase?.name ?? null,
    changedFields: changed,
    message: `Tugas "${updated.title}" berhasil diperbarui${changed.length > 0 ? ` (${changed.join(", ")})` : ""}.`,
  };
}

/** Edit tugas berdasarkan nama ruangan + kata kunci judul. */
export async function agentEditTaskInRoom(
  user: AgentUser,
  input: {
    roomNameOrId: string;
    taskTitleSearch: string;
    processPhaseNameOrId?: string | null;
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    status?: TaskStatus;
    dueDate?: string | null;
    assignCurrentUserAsPic?: boolean;
    assigneeNames?: string[];
  },
) {
  const hasChange =
    input.title !== undefined ||
    input.description !== undefined ||
    input.priority !== undefined ||
    input.status !== undefined ||
    input.dueDate !== undefined ||
    input.assignCurrentUserAsPic === true ||
    (input.assigneeNames?.length ?? 0) > 0;

  if (!hasChange) {
    throw new Error("Tidak ada field yang diubah. Sebutkan apa yang ingin diedit.");
  }

  const room = await resolveAgentRoom(user, input.roomNameOrId);
  const tasks = await findAgentTasksForMove(user, {
    roomId: room.id,
    roomName: room.name,
    taskTitleSearch: input.taskTitleSearch,
    processPhaseNameOrId: input.processPhaseNameOrId,
  });

  if (tasks.length === 0) {
    throw new Error(
      `Tugas "${input.taskTitleSearch}" tidak ditemukan di ruangan "${room.name}".`,
    );
  }

  let assigneeIds: string[] | undefined;
  if (input.assigneeNames?.length) {
    assigneeIds = await resolveAssigneeIdsByName(
      user,
      room.id,
      input.assigneeNames,
    );
  }

  return agentUpdateTask(user, {
    taskId: tasks[0]!.id,
    title: input.title,
    description: input.description,
    priority: input.priority,
    status: input.status,
    dueDate: input.dueDate,
    assigneeIds,
    assignCurrentUserAsPic: input.assignCurrentUserAsPic,
  });
}

/** Pindahkan tugas berdasarkan nama ruangan + kata kunci judul. */
export async function agentMoveTaskInRoom(
  user: AgentUser,
  input: {
    roomNameOrId: string;
    taskTitleSearch: string;
    status: TaskStatus;
    processPhaseNameOrId?: string | null;
  },
) {
  const room = await resolveAgentRoom(user, input.roomNameOrId);
  const tasks = await findAgentTasksForMove(user, {
    roomId: room.id,
    roomName: room.name,
    taskTitleSearch: input.taskTitleSearch,
    processPhaseNameOrId: input.processPhaseNameOrId,
  });

  if (tasks.length === 0) {
    throw new Error(
      `Tugas "${input.taskTitleSearch}" tidak ditemukan di ruangan "${room.name}"${
        input.processPhaseNameOrId
          ? ` pada fase "${input.processPhaseNameOrId}"`
          : ""
      }.`,
    );
  }

  const moved = await agentMoveTaskStatus(user, {
    taskId: tasks[0]!.id,
    status: input.status,
  });

  return {
    ...moved,
    resolvedRoom: room.name,
    resolvedPhase: tasks[0]!.phaseName,
  };
}

export async function agentMoveTaskStatus(
  user: AgentUser,
  input: { taskId: string; status: TaskStatus },
) {
  const { roomId, phase } = await getTaskRoomContext(input.taskId);
  await assertAgentRoomAccess(user, roomId);

  if (!canSeeAllRooms(user)) {
    await assertRoomMemberHasTaskPhase(roomId, user.id, phase);
  }

  const task = await prisma.task.findUniqueOrThrow({
    where: { id: input.taskId },
    select: {
      id: true,
      projectId: true,
      title: true,
      status: true,
      dueDate: true,
      roomProcess: true,
      customProcessPhaseId: true,
      kanbanColumnId: true,
      kanbanColumn: {
        select: { kind: true, coreRole: true, linkedStatus: true },
      },
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
    throw new Error("Tugas diarsipkan. Pulihkan dulu untuk mengubah status.");
  }

  // Status = kategori turunan Tahap (kolom); OVERDUE legacy runtuh ke bucket kerja.
  const bucket = bucketFromLegacyStatus(input.status);

  if (
    bucket === TaskStatus.DONE &&
    task.isApprovalRequired &&
    !task.isApproved
  ) {
    throw new Error(
      "Tugas ini memerlukan persetujuan CEO sebelum ditandai selesai.",
    );
  }

  const prevStatus = task.status;
  // Kartu ikut pindah kolom — kecuali kolomnya sudah se-bucket (mis. kolom
  // custom "Revisi" ber-bucket Berjalan: tetap di sana).
  const currentBucket = task.kanbanColumn
    ? kanbanColumnBucket(task.kanbanColumn)
    : null;
  const targetColumnId =
    currentBucket === bucket
      ? task.kanbanColumnId
      : await resolveBoardColumnIdForBucket(roomId, task, bucket);
  const nextStatus = effectiveTaskStatus(bucket, task.dueDate);
  const markingDone = bucket === TaskStatus.DONE && prevStatus !== TaskStatus.DONE;

  await prisma.task.update({
    where: { id: input.taskId },
    data: {
      status: nextStatus,
      ...(targetColumnId ? { kanbanColumnId: targetColumnId } : {}),
      ...(markingDone
        ? {
            whatsappReminder3dSentAt: null,
            whatsappReminder1dSentAt: null,
          }
        : {}),
    },
  });

  if (markingDone) {
    if (task.contentPlanItemId && task.contentPlanJenis) {
      await syncContentPlanRowFromCompletedKanbanTask({
        roomId: task.project.room.id,
        itemId: task.contentPlanItemId,
        taskId: task.id,
        jenisKonten: task.contentPlanJenis,
      });
    }

    void notifyTaskCompletedForCeo(
      task.title,
      taskProjectContextLabel(task.project),
    );
    void notifyRoomManagersTaskDoneViaWhatsApp({
      roomId: task.project.roomId,
      roomProcess: phase.legacyProcessKey ?? RoomTaskProcess.MARKET_RESEARCH,
      taskTitle: task.title,
      project: task.project,
      picDisplayName: task.assignees[0]?.user?.name ?? null,
    });
  }

  if (prevStatus !== nextStatus) {
    void recomputeProjectProgress(task.projectId);
  }

  return {
    taskId: task.id,
    title: task.title,
    previousStatus: prevStatus,
    newStatus: nextStatus,
    message: `Tugas "${task.title}" dipindahkan ke status ${nextStatus}.`,
  };
}

/** Pindahkan beberapa tugas sekaligus ke status baru. */
export async function agentMoveTasksInRoom(
  user: AgentUser,
  input: {
    roomNameOrId: string;
    status: TaskStatus;
    taskTitleSearches?: string[] | null;
    taskTitleSearch?: string | null;
    fromStatus?: TaskStatus | null;
    processPhaseNameOrId?: string | null;
  },
) {
  const room = await resolveAgentRoom(user, input.roomNameOrId);
  const tasks = await findAgentTasksForBulkOperation(user, {
    roomId: room.id,
    roomName: room.name,
    taskTitleSearches: input.taskTitleSearches,
    taskTitleSearch: input.taskTitleSearch,
    processPhaseNameOrId: input.processPhaseNameOrId,
    status: input.fromStatus ?? undefined,
  });

  const movedTitles: string[] = [];
  const errors: string[] = [];

  for (const task of tasks) {
    try {
      const result = await agentMoveTaskStatus(user, {
        taskId: task.id,
        status: input.status,
      });
      movedTitles.push(result.title);
    } catch (err) {
      errors.push(
        `${task.title}: ${err instanceof Error ? err.message : "gagal"}`,
      );
    }
  }

  return {
    roomId: room.id,
    roomName: room.name,
    targetStatus: input.status,
    movedCount: movedTitles.length,
    movedTitles,
    skippedCount: errors.length,
    errors: errors.length > 0 ? errors : undefined,
    message:
      movedTitles.length > 0
        ? `${movedTitles.length} tugas dipindahkan ke status ${input.status} di "${room.name}".`
        : `Gagal memindahkan tugas: ${errors.join("; ")}`,
  };
}

export async function agentDeleteTask(
  user: AgentUser,
  input: { taskId: string },
) {
  const { roomId, phase } = await getTaskRoomContext(input.taskId);
  await assertAgentRoomManager(user, roomId);

  const simpleHub = await isSimpleHubRoom(roomId);
  if (!canSeeAllRooms(user) && !simpleHub) {
    const member = await prisma.roomMember.findUniqueOrThrow({
      where: { roomId_userId: { roomId, userId: user.id } },
      select: {
        role: true,
        allowedRoomProcesses: true,
        allowedCustomProcessPhaseIds: true,
      },
    });
    if (
      member.role === RoomMemberRole.ROOM_MANAGER &&
      !memberHasRoomPhaseAccess(
        roomMemberToProcessAccess(member),
        phase,
      )
    ) {
      throw new Error(
        "Anda tidak memiliki akses ke fase proses tugas ini untuk menghapusnya.",
      );
    }
  }

  const task = await prisma.task.findUniqueOrThrow({
    where: { id: input.taskId },
    select: { projectId: true, title: true },
  });

  await prisma.task.delete({ where: { id: input.taskId } });
  void recomputeProjectProgress(task.projectId);

  return {
    taskId: input.taskId,
    title: task.title,
    message: `Tugas "${task.title}" berhasil dihapus.`,
  };
}

/**
 * Hapus satu tugas — konfirmasi dijaga server: eksekusi butuh confirmToken
 * dari preview + pesan user terakhir berupa konfirmasi eksplisit.
 */
export async function agentDeleteTaskInRoom(
  user: AgentUser,
  input: {
    roomNameOrId: string;
    taskTitleSearch: string;
    processPhaseNameOrId?: string | null;
    confirmed: boolean;
    confirmToken?: string | null;
    latestUserMessage?: string | null;
  },
) {
  const room = await resolveAgentRoom(user, input.roomNameOrId);
  const tasks = await findAgentTasksForMove(user, {
    roomId: room.id,
    roomName: room.name,
    taskTitleSearch: input.taskTitleSearch,
    processPhaseNameOrId: input.processPhaseNameOrId,
  });

  if (tasks.length === 0) {
    throw new Error(
      `Tugas "${input.taskTitleSearch}" tidak ditemukan di ruangan "${room.name}".`,
    );
  }

  const taskIds = tasks.map((t) => t.id);
  const confirmGate = deleteConfirmationGate(user, room.id, taskIds, input);
  if (!input.confirmed || confirmGate) {
    return {
      needsConfirmation: true,
      action: "delete",
      roomName: room.name,
      taskCount: tasks.length,
      confirmToken: buildDeleteConfirmToken(user.id, room.id, taskIds),
      ...(input.confirmed && confirmGate ? { blockedReason: confirmGate } : {}),
      tasks: tasks.map((t) => ({
        title: t.title,
        phaseName: t.phaseName,
        statusLabel: t.statusLabel,
      })),
      instruction: formatDeleteConfirmationMessage(room.name, tasks),
      message: formatDeleteConfirmationMessage(room.name, tasks),
    };
  }

  return agentDeleteTask(user, { taskId: tasks[0]!.id });
}

/**
 * Alasan eksekusi hapus masih harus ditahan meski model mengirim
 * confirmed:true — null berarti boleh lanjut.
 */
function deleteConfirmationGate(
  user: AgentUser,
  roomId: string,
  taskIds: string[],
  input: { confirmToken?: string | null; latestUserMessage?: string | null },
): string | null {
  if (!deleteConfirmTokenMatches(input.confirmToken, user.id, roomId, taskIds)) {
    return "confirmToken tidak cocok dengan daftar tugas saat ini — tampilkan preview ini ke user dan minta konfirmasi ulang.";
  }
  if (!isExplicitDeleteConfirmation(input.latestUserMessage)) {
    return "User belum menjawab konfirmasi eksplisit (mis. \"ya\" / \"hapus saja\"). Tampilkan preview dan tunggu jawaban user — jangan panggil confirmed:true lagi sebelum user menjawab.";
  }
  return null;
}

/** Hapus beberapa tugas sekaligus — wajib konfirmasi user (confirmed: true). */
export async function agentDeleteTasksInRoom(
  user: AgentUser,
  input: {
    roomNameOrId: string;
    confirmed: boolean;
    confirmToken?: string | null;
    latestUserMessage?: string | null;
    taskTitleSearches?: string[] | null;
    taskTitleSearch?: string | null;
    fromStatus?: TaskStatus | null;
    processPhaseNameOrId?: string | null;
  },
) {
  const room = await resolveAgentRoom(user, input.roomNameOrId);
  const tasks = await findAgentTasksForBulkOperation(user, {
    roomId: room.id,
    roomName: room.name,
    taskTitleSearches: input.taskTitleSearches,
    taskTitleSearch: input.taskTitleSearch,
    processPhaseNameOrId: input.processPhaseNameOrId,
    status: input.fromStatus ?? undefined,
  });

  const taskIds = tasks.map((t) => t.id);
  const confirmGate = deleteConfirmationGate(user, room.id, taskIds, input);
  if (!input.confirmed || confirmGate) {
    return {
      needsConfirmation: true,
      action: "delete_bulk",
      roomName: room.name,
      taskCount: tasks.length,
      confirmToken: buildDeleteConfirmToken(user.id, room.id, taskIds),
      ...(input.confirmed && confirmGate ? { blockedReason: confirmGate } : {}),
      tasks: tasks.map((t) => ({
        title: t.title,
        phaseName: t.phaseName,
        statusLabel: t.statusLabel,
      })),
      instruction: formatDeleteConfirmationMessage(room.name, tasks),
      message: formatDeleteConfirmationMessage(room.name, tasks),
    };
  }

  const deletedTitles: string[] = [];
  const errors: string[] = [];

  for (const task of tasks) {
    try {
      const result = await agentDeleteTask(user, { taskId: task.id });
      deletedTitles.push(result.title);
    } catch (err) {
      errors.push(
        `${task.title}: ${err instanceof Error ? err.message : "gagal"}`,
      );
    }
  }

  return {
    roomId: room.id,
    roomName: room.name,
    deletedCount: deletedTitles.length,
    deletedTitles,
    skippedCount: errors.length,
    errors: errors.length > 0 ? errors : undefined,
    message:
      deletedTitles.length > 0
        ? `${deletedTitles.length} tugas berhasil dihapus dari "${room.name}".`
        : `Gagal menghapus tugas: ${errors.join("; ")}`,
  };
}

export async function agentAddTaskComment(
  user: AgentUser,
  input: { taskId: string; body: string },
) {
  const text = input.body.trim();
  if (!text) throw new Error("Komentar tidak boleh kosong.");

  const { roomId, phase } = await getTaskRoomContext(input.taskId);
  await assertAgentRoomAccess(user, roomId);
  if (!canSeeAllRooms(user)) {
    await assertRoomMemberHasTaskPhase(roomId, user.id, phase);
  }

  const comment = await prisma.taskComment.create({
    data: {
      taskId: input.taskId,
      authorId: user.id,
      body: text,
    },
    select: { id: true, body: true, createdAt: true },
  });

  return {
    commentId: comment.id,
    body: comment.body,
    message: "Komentar berhasil ditambahkan.",
  };
}

export async function agentAddTaskCommentInRoom(
  user: AgentUser,
  input: {
    roomNameOrId: string;
    taskTitleSearch: string;
    body: string;
    processPhaseNameOrId?: string | null;
  },
) {
  const room = await resolveAgentRoom(user, input.roomNameOrId);
  const tasks = await findAgentTasksForMove(user, {
    roomId: room.id,
    roomName: room.name,
    taskTitleSearch: input.taskTitleSearch,
    processPhaseNameOrId: input.processPhaseNameOrId,
  });

  if (tasks.length === 0) {
    throw new Error(
      `Tugas "${input.taskTitleSearch}" tidak ditemukan di ruangan "${room.name}".`,
    );
  }

  return agentAddTaskComment(user, {
    taskId: tasks[0]!.id,
    body: input.body,
  });
}

export async function agentArchiveTask(
  user: AgentUser,
  input: { taskId: string },
) {
  const { roomId, phase } = await getTaskRoomContext(input.taskId);
  await assertAgentRoomManager(user, roomId);

  const simpleHub = await isSimpleHubRoom(roomId);
  if (!canSeeAllRooms(user) && !simpleHub) {
    const member = await prisma.roomMember.findUniqueOrThrow({
      where: { roomId_userId: { roomId, userId: user.id } },
      select: {
        role: true,
        allowedRoomProcesses: true,
        allowedCustomProcessPhaseIds: true,
      },
    });
    if (
      member.role === RoomMemberRole.ROOM_MANAGER &&
      !memberHasRoomPhaseAccess(
        roomMemberToProcessAccess(member),
        phase,
      )
    ) {
      throw new Error("Anda tidak dapat mengarsipkan tugas di fase proses ini.");
    }
  }

  const t = await prisma.task.findUniqueOrThrow({
    where: { id: input.taskId },
    select: { status: true, archivedAt: true, projectId: true, title: true },
  });
  if (t.status !== TaskStatus.DONE) {
    throw new Error("Hanya tugas berstatus Selesai yang dapat diarsipkan.");
  }
  if (t.archivedAt) {
    throw new Error("Tugas ini sudah diarsipkan.");
  }

  await prisma.task.update({
    where: { id: input.taskId },
    data: { archivedAt: new Date() },
  });
  void recomputeProjectProgress(t.projectId);

  return {
    taskId: input.taskId,
    title: t.title,
    message: `Tugas "${t.title}" berhasil diarsipkan.`,
  };
}

export async function agentArchiveTaskInRoom(
  user: AgentUser,
  input: {
    roomNameOrId: string;
    taskTitleSearch: string;
    processPhaseNameOrId?: string | null;
  },
) {
  const room = await resolveAgentRoom(user, input.roomNameOrId);
  const tasks = await findAgentTasksForMove(user, {
    roomId: room.id,
    roomName: room.name,
    taskTitleSearch: input.taskTitleSearch,
    processPhaseNameOrId: input.processPhaseNameOrId,
  });

  if (tasks.length === 0) {
    throw new Error(
      `Tugas "${input.taskTitleSearch}" tidak ditemukan di ruangan "${room.name}".`,
    );
  }

  return agentArchiveTask(user, { taskId: tasks[0]!.id });
}

/** Arsipkan semua tugas berstatus DONE di ruangan (opsional filter fase). */
export async function agentArchiveCompletedTasksInRoom(
  user: AgentUser,
  input: {
    roomNameOrId: string;
    processPhaseNameOrId?: string | null;
  },
) {
  const room = await resolveAgentRoom(user, input.roomNameOrId);
  let phaseName: string | null = null;
  if (input.processPhaseNameOrId?.trim()) {
    const phase = await resolveAgentProcessPhase(
      user,
      room.id,
      input.processPhaseNameOrId,
    );
    phaseName = phase.name;
  }

  const tasks = await listAgentTasks(user, {
    roomId: room.id,
    status: TaskStatus.DONE,
    processPhaseNameOrId: input.processPhaseNameOrId ?? undefined,
    limit: 50,
  });

  if (tasks.length === 0) {
    return {
      roomId: room.id,
      roomName: room.name,
      phaseName,
      archivedCount: 0,
      archivedTitles: [] as string[],
      message: `Tidak ada tugas selesai untuk diarsipkan di "${room.name}"${phaseName ? ` fase ${phaseName}` : ""}.`,
    };
  }

  const archivedTitles: string[] = [];
  const errors: string[] = [];

  for (const task of tasks) {
    try {
      const result = await agentArchiveTask(user, { taskId: task.id });
      archivedTitles.push(result.title);
    } catch (err) {
      errors.push(
        `${task.title}: ${err instanceof Error ? err.message : "gagal"}`,
      );
    }
  }

  return {
    roomId: room.id,
    roomName: room.name,
    phaseName,
    archivedCount: archivedTitles.length,
    archivedTitles,
    skippedCount: errors.length,
    errors: errors.length > 0 ? errors : undefined,
    message:
      archivedTitles.length > 0
        ? `${archivedTitles.length} tugas selesai diarsipkan di "${room.name}"${phaseName ? ` (${phaseName})` : ""}.`
        : `Gagal mengarsipkan tugas: ${errors.join("; ")}`,
  };
}

export async function agentToggleChecklistItem(
  user: AgentUser,
  input: { checklistItemId: string; done: boolean },
) {
  const item = await prisma.taskChecklistItem.findUniqueOrThrow({
    where: { id: input.checklistItemId },
    select: {
      id: true,
      title: true,
      done: true,
      taskId: true,
      task: {
        select: {
          project: { select: { roomId: true } },
          roomProcess: true,
          customProcessPhaseId: true,
          customProcessPhase: {
            select: { id: true, name: true, legacyProcessKey: true },
          },
        },
      },
    },
  });

  const roomId = item.task.project.roomId;
  await assertAgentRoomAccess(user, roomId);
  const phase = taskToPhaseRef(item.task);
  if (!canSeeAllRooms(user)) {
    await assertRoomMemberHasTaskPhase(roomId, user.id, phase);
  }

  await prisma.taskChecklistItem.update({
    where: { id: input.checklistItemId },
    data: { done: input.done },
  });

  return {
    checklistItemId: item.id,
    title: item.title,
    done: input.done,
    message: `Checklist "${item.title}" ${input.done ? "ditandai selesai" : "dibuka kembali"}.`,
  };
}

export async function agentToggleChecklistInRoom(
  user: AgentUser,
  input: {
    roomNameOrId: string;
    taskTitleSearch: string;
    checklistTitleSearch: string;
    done: boolean;
    processPhaseNameOrId?: string | null;
  },
) {
  const room = await resolveAgentRoom(user, input.roomNameOrId);
  const tasks = await findAgentTasksForMove(user, {
    roomId: room.id,
    roomName: room.name,
    taskTitleSearch: input.taskTitleSearch,
    processPhaseNameOrId: input.processPhaseNameOrId,
  });

  if (tasks.length === 0) {
    throw new Error(
      `Tugas "${input.taskTitleSearch}" tidak ditemukan di ruangan "${room.name}".`,
    );
  }

  const detail = await prisma.task.findUniqueOrThrow({
    where: { id: tasks[0]!.id },
    select: {
      checklistItems: {
        select: { id: true, title: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const q = input.checklistTitleSearch.trim().toLowerCase();
  const matches = detail.checklistItems.filter((c) =>
    c.title.toLowerCase().includes(q),
  );

  if (matches.length === 0) {
    throw new Error(
      `Item checklist "${input.checklistTitleSearch}" tidak ditemukan di tugas ini.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Beberapa item cocok: ${matches.map((m) => m.title).join(", ")}. Sebutkan lebih spesifik.`,
    );
  }

  return agentToggleChecklistItem(user, {
    checklistItemId: matches[0]!.id,
    done: input.done,
  });
}

export async function agentAddChecklistInRoom(
  user: AgentUser,
  input: {
    roomNameOrId: string;
    taskTitleSearch: string;
    title: string;
    processPhaseNameOrId?: string | null;
  },
) {
  const room = await resolveAgentRoom(user, input.roomNameOrId);
  const tasks = await findAgentTasksForMove(user, {
    roomId: room.id,
    roomName: room.name,
    taskTitleSearch: input.taskTitleSearch,
    processPhaseNameOrId: input.processPhaseNameOrId,
  });

  if (tasks.length === 0) {
    throw new Error(
      `Tugas "${input.taskTitleSearch}" tidak ditemukan di ruangan "${room.name}".`,
    );
  }

  return agentAddChecklistItem(user, {
    taskId: tasks[0]!.id,
    title: input.title,
  });
}

export async function agentAddChecklistItem(
  user: AgentUser,
  input: { taskId: string; title: string },
) {
  const { roomId, phase } = await getTaskRoomContext(input.taskId);
  await assertAgentRoomAccess(user, roomId);
  if (!canSeeAllRooms(user)) {
    await assertRoomMemberHasTaskPhase(roomId, user.id, phase);
  }

  const max = await prisma.taskChecklistItem.aggregate({
    where: { taskId: input.taskId },
    _max: { sortOrder: true },
  });

  const item = await prisma.taskChecklistItem.create({
    data: {
      taskId: input.taskId,
      title: input.title.trim(),
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
    select: { id: true, title: true },
  });

  return {
    id: item.id,
    title: item.title,
    message: `Checklist "${item.title}" ditambahkan.`,
  };
}

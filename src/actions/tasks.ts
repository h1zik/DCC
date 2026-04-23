"use server";

import { revalidatePath } from "next/cache";
import {
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
  assertRoomHubManager,
  assertRoomMember,
  assertRoomMemberHasTaskProcess,
  getProjectRoomId,
  getTaskRoomContext,
  isRoomHubManagerRole,
  memberHasRoomProcessAccess,
  roomMemberToProcessAccess,
} from "@/lib/room-access";

const moveSchema = z.object({
  taskId: z.string().min(1),
  status: z.nativeEnum(TaskStatus),
});

async function validateAssigneesForRoom(params: {
  roomId: string;
  assigneeIds: string[];
  roomProcess: RoomTaskProcess;
  simpleHub: boolean;
}) {
  const { roomId, assigneeIds, roomProcess, simpleHub } = params;
  if (assigneeIds.length === 0) return;

  const members = await prisma.roomMember.findMany({
    where: { roomId, userId: { in: assigneeIds } },
    select: {
      userId: true,
      role: true,
      allowedRoomProcesses: true,
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
      !memberHasRoomProcessAccess(
        roomMemberToProcessAccess(member),
        roomProcess,
      )
    ) {
      throw new Error("PIC tidak memiliki akses ke fase proses tugas ini.");
    }
  }
}

export async function moveTaskStatus(input: z.infer<typeof moveSchema>) {
  const session = await requireTasksRoomHubSession();
  const { taskId, status } = moveSchema.parse(input);
  const { roomId, roomProcess } = await getTaskRoomContext(taskId);
  await assertRoomMemberHasTaskProcess(roomId, session.user.id, roomProcess);

  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      title: true,
      status: true,
      isApprovalRequired: true,
      isApproved: true,
      archivedAt: true,
      project: {
        include: { brand: true, room: { select: { name: true } } },
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
      status,
      ...(status === TaskStatus.DONE && task.status !== TaskStatus.DONE
        ? {
            whatsappReminder3dSentAt: null,
            whatsappReminder1dSentAt: null,
          }
        : {}),
    },
  });

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
  const { roomId, roomProcess } = await getTaskRoomContext(taskId);
  const simpleHub = await isSimpleHubRoom(roomId);
  const hubManager = await assertRoomHubManager(roomId, session.user.id);
  if (
    !simpleHub &&
    hubManager.role === RoomMemberRole.ROOM_MANAGER &&
    !memberHasRoomProcessAccess(
      roomMemberToProcessAccess(hubManager),
      roomProcess,
    )
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
  const { roomId, roomProcess } = await getTaskRoomContext(taskId);
  const simpleHub = await isSimpleHubRoom(roomId);
  const hubManager = await assertRoomHubManager(roomId, session.user.id);
  if (
    !simpleHub &&
    hubManager.role === RoomMemberRole.ROOM_MANAGER &&
    !memberHasRoomProcessAccess(
      roomMemberToProcessAccess(hubManager),
      roomProcess,
    )
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

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
  priority: z.nativeEnum(TaskPriority),
  status: z.nativeEnum(TaskStatus).optional(),
  dueDate: z.coerce.date().optional().nullable(),
  isApprovalRequired: z.boolean().optional(),
  vendorId: z.string().optional().nullable(),
  leadTimeDays: z.coerce.number().int().min(0).optional().nullable(),
  roomProcess: z.nativeEnum(RoomTaskProcess).optional(),
});

const taskMutationInclude = {
  project: { include: { brand: true, room: { select: { name: true } } } },
  assignees: {
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  },
  vendor: { select: { id: true, name: true } },
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

  const roomProcess = simpleHub
    ? RoomTaskProcess.MARKET_RESEARCH
    : (data.roomProcess ?? RoomTaskProcess.MARKET_RESEARCH);
  if (
    !simpleHub &&
    hubManager.role === RoomMemberRole.ROOM_MANAGER &&
    !memberHasRoomProcessAccess(
      roomMemberToProcessAccess(hubManager),
      roomProcess,
    )
  ) {
    throw new Error(
      "Anda tidak memiliki akses ke fase proses ini untuk membuat tugas.",
    );
  }

  const assigneeIds = [...new Set(data.assigneeIds ?? [])].filter(Boolean);
  await validateAssigneesForRoom({
    roomId,
    assigneeIds,
    roomProcess,
    simpleHub,
  });

  const maxSort = await prisma.task.aggregate({
    where: { projectId: data.projectId, roomProcess },
    _max: { sortOrder: true },
  });

  const task = await prisma.task.create({
    data: {
      projectId: data.projectId,
      roomProcess,
      title: data.title,
      description: data.description ?? undefined,
      priority: data.priority,
      status: data.status ?? TaskStatus.TODO,
      dueDate: data.dueDate ?? undefined,
      isApprovalRequired: data.isApprovalRequired ?? false,
      vendorId: data.vendorId || undefined,
      leadTimeDays: data.leadTimeDays ?? undefined,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      assignees: {
        create: assigneeIds.map((userId) => ({ userId })),
      },
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

const updateSchema = createSchema.extend({
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
      status: true,
      isApprovalRequired: true,
      isApproved: true,
      assignees: { select: { userId: true } },
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

  await assertRoomMemberHasTaskProcess(
    roomId,
    session.user.id,
    prev.roomProcess,
  );

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
  let isApprovalRequired = data.isApprovalRequired ?? false;

  let roomProcess =
    data.roomProcess !== undefined ? data.roomProcess : prev.roomProcess;
  if (simpleHub) {
    roomProcess = RoomTaskProcess.MARKET_RESEARCH;
  }

  if (roomProcess !== prev.roomProcess) {
    await assertRoomMemberHasTaskProcess(
      roomId,
      session.user.id,
      roomProcess,
    );
  }

  if (!isHubManager) {
    projectId = prev.projectId;
    assigneeIds = prev.assignees.map((a) => a.userId);
    isApprovalRequired = prev.isApprovalRequired;
  } else {
    const newProjectRoomId = await getProjectRoomId(projectId);
    if (newProjectRoomId !== roomId) {
      throw new Error("Proyek harus tetap dalam ruangan yang sama.");
    }
    await validateAssigneesForRoom({
      roomId,
      assigneeIds,
      roomProcess,
      simpleHub,
    });
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

  const task = await prisma.task.update({
    where: { id: data.taskId },
    data: {
      projectId,
      roomProcess,
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
      ...(assigneesChanged
        ? {
            assignees: {
              deleteMany: {},
              create: assigneeIds.map((userId) => ({ userId })),
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
    notificationJobs.push(
      notifyTaskCompletedForCeo(
        task.title,
        taskProjectContextLabel(task.project),
      ),
    );
    notificationJobs.push(
      notifyRoomManagersTaskDoneViaWhatsApp({
        roomId: task.project.roomId,
        taskTitle: task.title,
        project: task.project,
        picDisplayName: task.assignees[0]?.user?.name ?? null,
      }),
    );
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
  const { roomId, roomProcess } = await getTaskRoomContext(taskId);
  const hubManager = await assertRoomHubManager(roomId, session.user.id);
  const simpleHub = await isSimpleHubRoom(roomId);
  if (
    !simpleHub &&
    hubManager.role === RoomMemberRole.ROOM_MANAGER &&
    !memberHasRoomProcessAccess(
      roomMemberToProcessAccess(hubManager),
      roomProcess,
    )
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

async function checklistTaskContextOrThrow(checklistItemId: string) {
  const item = await prisma.taskChecklistItem.findUniqueOrThrow({
    where: { id: checklistItemId },
    select: { taskId: true },
  });
  return getTaskRoomContext(item.taskId);
}

export async function addChecklistItem(taskId: string, title: string) {
  const session = await requireTasksRoomHubSession();
  const { roomId, roomProcess } = await getTaskRoomContext(taskId);
  await assertRoomMemberHasTaskProcess(roomId, session.user.id, roomProcess);

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
  const { roomId, roomProcess } = await checklistTaskContextOrThrow(id);
  await assertRoomMemberHasTaskProcess(roomId, session.user.id, roomProcess);

  await prisma.taskChecklistItem.update({
    where: { id },
    data: { done },
  });
  revalidateTasksAndRoomHub();
}

export async function deleteChecklistItem(id: string) {
  const session = await requireTasksRoomHubSession();
  const { roomId, roomProcess } = await checklistTaskContextOrThrow(id);
  await assertRoomMemberHasTaskProcess(roomId, session.user.id, roomProcess);

  await prisma.taskChecklistItem.delete({ where: { id } });
  revalidateTasksAndRoomHub();
}

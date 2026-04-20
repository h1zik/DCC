"use server";

import { revalidatePath } from "next/cache";
import {
  NotificationType,
  RoomMemberRole,
  RoomTaskProcess,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { notifyCeo, notifyTaskCompletedForCeo } from "@/lib/notify";
import { recomputeProjectProgress } from "@/lib/project-progress";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import {
  isSimpleHubRoom,
  taskProjectContextLabel,
} from "@/lib/room-simple-hub";
import {
  assertRoomContributorForPic,
  assertRoomHubManager,
  assertRoomMember,
  assertRoomMemberHasTaskProcess,
  assertSimpleHubAssignee,
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

export async function moveTaskStatus(input: z.infer<typeof moveSchema>) {
  const session = await requireTasksRoomHubSession();
  const { taskId, status } = moveSchema.parse(input);
  const { roomId, roomProcess } = await getTaskRoomContext(taskId);
  await assertRoomMemberHasTaskProcess(roomId, session.user.id, roomProcess);

  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: {
      project: { include: { brand: true, room: { select: { name: true } } } },
    },
  });

  if (status === TaskStatus.DONE && task.isApprovalRequired && !task.isApproved) {
    throw new Error(
      "Tugas ini memerlukan persetujuan CEO sebelum ditandai selesai.",
    );
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { status },
  });

  if (status === TaskStatus.DONE && task.status !== TaskStatus.DONE) {
    await notifyTaskCompletedForCeo(
      task.title,
      taskProjectContextLabel(task.project),
    );
  }

  await recomputeProjectProgress(task.projectId);
  revalidateTasksAndRoomHub();
  revalidatePath("/projects");
  revalidatePath("/");
  revalidatePath("/approvals");
}

const createSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  priority: z.nativeEnum(TaskPriority),
  status: z.nativeEnum(TaskStatus).optional(),
  dueDate: z.coerce.date().optional().nullable(),
  isApprovalRequired: z.boolean().optional(),
  vendorId: z.string().optional().nullable(),
  leadTimeDays: z.coerce.number().int().min(0).optional().nullable(),
  roomProcess: z.nativeEnum(RoomTaskProcess).optional(),
});

export async function createTask(input: z.infer<typeof createSchema>) {
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

  let assigneeId: string | undefined = data.assigneeId ?? undefined;
  if (assigneeId) {
    if (simpleHub) {
      await assertSimpleHubAssignee(roomId, assigneeId);
    } else {
      await assertRoomContributorForPic(roomId, assigneeId, roomProcess);
    }
  }

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
      assigneeId,
      priority: data.priority,
      status: data.status ?? TaskStatus.TODO,
      dueDate: data.dueDate ?? undefined,
      isApprovalRequired: data.isApprovalRequired ?? false,
      vendorId: data.vendorId || undefined,
      leadTimeDays: data.leadTimeDays ?? undefined,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
    include: {
      project: { include: { brand: true, room: { select: { name: true } } } },
    },
  });

  if (task.isApprovalRequired && !task.isApproved) {
    await notifyCeo(
      `Persetujuan diminta: ${task.title} (${taskProjectContextLabel(task.project)})`,
      NotificationType.CEO_APPROVAL_REQUESTED,
    );
  }

  await recomputeProjectProgress(data.projectId);
  revalidateTasksAndRoomHub();
  revalidatePath("/projects");
  revalidatePath("/approvals");
}

const updateSchema = createSchema.extend({
  taskId: z.string().min(1),
  status: z.nativeEnum(TaskStatus).optional(),
});

export async function updateTask(input: z.infer<typeof updateSchema>) {
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
      assigneeId: true,
      project: { select: { roomId: true } },
    },
  });
  const roomId = prev.project.roomId;
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
  let assigneeId = (data.assigneeId ?? null) as string | null;
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
    assigneeId = prev.assigneeId ?? null;
    isApprovalRequired = prev.isApprovalRequired;
  } else {
    const newProjectRoomId = await getProjectRoomId(projectId);
    if (newProjectRoomId !== roomId) {
      throw new Error("Proyek harus tetap dalam ruangan yang sama.");
    }
    if (assigneeId) {
      if (simpleHub) {
        await assertSimpleHubAssignee(roomId, assigneeId);
      } else {
        await assertRoomContributorForPic(roomId, assigneeId, roomProcess);
      }
    }
  }

  await prisma.task.update({
    where: { id: data.taskId },
    data: {
      projectId,
      roomProcess,
      title: data.title,
      description: data.description ?? null,
      assigneeId,
      priority: data.priority,
      dueDate: data.dueDate ?? null,
      isApprovalRequired,
      vendorId: data.vendorId || null,
      leadTimeDays: data.leadTimeDays ?? null,
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });

  const task = await prisma.task.findUniqueOrThrow({
    where: { id: data.taskId },
    include: {
      project: { include: { brand: true, room: { select: { name: true } } } },
    },
  });

  const becameApproval =
    task.isApprovalRequired &&
    !task.isApproved &&
    !prev.isApprovalRequired;

  if (becameApproval) {
    await notifyCeo(
      `Persetujuan diminta: ${task.title} (${taskProjectContextLabel(task.project)})`,
      NotificationType.CEO_APPROVAL_REQUESTED,
    );
  }

  if (data.status === TaskStatus.DONE && prev.status !== TaskStatus.DONE) {
    await notifyTaskCompletedForCeo(
      task.title,
      taskProjectContextLabel(task.project),
    );
  }

  await recomputeProjectProgress(task.projectId);
  revalidateTasksAndRoomHub();
  revalidatePath("/projects");
  revalidatePath("/");
  revalidatePath("/approvals");
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
  await recomputeProjectProgress(task.projectId);
  revalidateTasksAndRoomHub();
  revalidatePath("/projects");
  revalidatePath("/");
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

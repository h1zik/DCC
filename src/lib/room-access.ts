import {
  RoomMemberRole,
  RoomTaskProcess,
  UserRole,
  type RoomMember,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSimpleHubRoom } from "@/lib/room-simple-hub";
import type { RoomProcessPhaseRef } from "@/lib/room-process-phase";
import { legacyPhaseRef, taskToPhaseRef } from "@/lib/room-process-phase";
import {
  isRoomHubManagerRole,
  memberHasRoomPhaseAccess,
  memberHasRoomProcessAccess,
  ROOM_PROJECT_MANAGER_ROLE,
  roomMemberToProcessAccess,
} from "@/lib/room-member-process-access";

const CEO_ROOM_MEMBER_BYPASS_ID = "__ceo_room_member__";

export {
  isRoomHubManagerRole,
  memberHasCustomProcessPhaseAccess,
  memberHasRoomPhaseAccess,
  memberHasRoomProcessAccess,
  roomMemberToProcessAccess,
  ROOM_PROJECT_MANAGER_ROLE,
  type RoomMemberProcessAccess,
} from "@/lib/room-member-process-access";

export async function getProjectRoomId(projectId: string): Promise<string> {
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { roomId: true },
  });
  return p.roomId;
}

export async function getTaskRoomId(taskId: string): Promise<string> {
  const t = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { project: { select: { roomId: true } } },
  });
  return t.project.roomId;
}

export async function getTaskRoomContext(taskId: string) {
  const t = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: {
      roomProcess: true,
      customProcessPhaseId: true,
      customProcessPhase: {
        select: { id: true, name: true, legacyProcessKey: true },
      },
      project: { select: { roomId: true } },
    },
  });
  const phase = taskToPhaseRef(t);
  return {
    roomId: t.project.roomId,
    roomProcess: t.roomProcess,
    customProcessPhaseId: t.customProcessPhaseId,
    phase,
  };
}

export async function assertRoomMemberHasTaskPhase(
  roomId: string,
  userId: string,
  phase: RoomProcessPhaseRef,
) {
  const m = await assertRoomMember(roomId, userId);
  if (await isSimpleHubRoom(roomId)) {
    return m;
  }
  if (!memberHasRoomPhaseAccess(roomMemberToProcessAccess(m), phase)) {
    throw new Error("Anda tidak memiliki akses ke fase proses tugas ini.");
  }
  return m;
}

/** @deprecated Prefer `assertRoomMemberHasTaskPhase` dengan `phase` dari konteks tugas. */
export async function assertRoomMemberHasTaskProcess(
  roomId: string,
  userId: string,
  roomProcess: RoomTaskProcess,
) {
  return assertRoomMemberHasTaskPhase(
    roomId,
    userId,
    legacyPhaseRef(roomProcess),
  );
}

/** Penanggung jawab tugas di ruangan mode sederhana: cukup jadi anggota ruangan. */
export async function assertSimpleHubAssignee(
  roomId: string,
  assigneeId: string,
) {
  const m = await getRoomMember(roomId, assigneeId);
  if (!m) {
    throw new Error("Penanggung jawab harus menjadi anggota ruangan ini.");
  }
}

export async function getRoomMember(roomId: string, userId: string) {
  return prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
}

export async function assertRoomMember(roomId: string, userId: string) {
  const m = await getRoomMember(roomId, userId);
  if (m) return m;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role === UserRole.CEO || user?.role === UserRole.ADMINISTRATOR) {
    await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    const synthetic: RoomMember = {
      id: CEO_ROOM_MEMBER_BYPASS_ID,
      roomId,
      userId,
      role: ROOM_PROJECT_MANAGER_ROLE,
      allowedRoomProcesses: [],
      allowedCustomProcessPhaseIds: [],
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    return synthetic;
  }

  throw new Error("Anda bukan anggota ruangan ini.");
}

/** Manager ruangan atau project manager ruangan (buat/hapus tugas, PIC, moderasi). */
export async function assertRoomHubManager(roomId: string, userId: string) {
  const m = await assertRoomMember(roomId, userId);
  if (!isRoomHubManagerRole(m.role)) {
    throw new Error(
      "Hanya manager ruangan atau project manager ruangan yang dapat melakukan aksi ini.",
    );
  }
  return m;
}

/** PIC tugas: anggota ruangan dengan akses fase (kontributor/manager/project manager). */
export async function assertRoomContributorForPic(
  roomId: string,
  userId: string,
  phase: RoomProcessPhaseRef,
) {
  const m = await getRoomMember(roomId, userId);
  if (!m) {
    throw new Error("PIC harus berupa anggota ruangan ini.");
  }
  if (
    m.role !== RoomMemberRole.ROOM_CONTRIBUTOR &&
    m.role !== RoomMemberRole.ROOM_MANAGER &&
    m.role !== RoomMemberRole.ROOM_PROJECT_MANAGER
  ) {
    throw new Error("PIC harus berupa kontributor/manager di ruangan ini.");
  }
  if (!memberHasRoomPhaseAccess(roomMemberToProcessAccess(m), phase)) {
    throw new Error("PIC tidak memiliki akses ke fase proses tugas ini.");
  }
}

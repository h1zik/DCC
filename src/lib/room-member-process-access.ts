import { RoomMemberRole, type RoomTaskProcess } from "@prisma/client";
import type { RoomProcessPhaseRef } from "@/lib/room-process-phase";

/** Nilai enum `RoomMemberRole.ROOM_PROJECT_MANAGER` (aman sebelum `prisma generate`). */
export const ROOM_PROJECT_MANAGER_ROLE =
  "ROOM_PROJECT_MANAGER" as unknown as RoomMemberRole;

export type RoomMemberProcessAccess = {
  role: RoomMemberRole;
  allowedRoomProcesses: RoomTaskProcess[];
  allowedCustomProcessPhaseIds: string[];
};

/** Normalisasi baris anggota ruangan dari Prisma (kolom baru mungkin belum ada di tipe client). */
export function roomMemberToProcessAccess(
  m: { role: RoomMemberRole } & {
    allowedRoomProcesses?: RoomTaskProcess[] | null;
    allowedCustomProcessPhaseIds?: string[] | null;
  },
): RoomMemberProcessAccess {
  return {
    role: m.role,
    allowedRoomProcesses: Array.isArray(m.allowedRoomProcesses)
      ? m.allowedRoomProcesses
      : [],
    allowedCustomProcessPhaseIds: Array.isArray(m.allowedCustomProcessPhaseIds)
      ? m.allowedCustomProcessPhaseIds
      : [],
  };
}

export function isRoomHubManagerRole(role: RoomMemberRole): boolean {
  return (
    role === RoomMemberRole.ROOM_MANAGER || role === ROOM_PROJECT_MANAGER_ROLE
  );
}

export function memberHasRoomProcessAccess(
  member: RoomMemberProcessAccess,
  process: RoomTaskProcess,
): boolean {
  if (member.role === ROOM_PROJECT_MANAGER_ROLE) return true;
  if (
    member.role === RoomMemberRole.ROOM_MANAGER ||
    member.role === RoomMemberRole.ROOM_CONTRIBUTOR
  ) {
    return member.allowedRoomProcesses.includes(process);
  }
  return false;
}

export function memberHasRoomPhaseAccess(
  member: RoomMemberProcessAccess,
  phase: RoomProcessPhaseRef,
): boolean {
  if (member.role === ROOM_PROJECT_MANAGER_ROLE) return true;
  if (
    member.role === RoomMemberRole.ROOM_MANAGER ||
    member.role === RoomMemberRole.ROOM_CONTRIBUTOR
  ) {
    if (member.allowedCustomProcessPhaseIds.includes(phase.id)) return true;
    if (
      phase.legacyProcessKey &&
      member.allowedRoomProcesses.includes(phase.legacyProcessKey)
    ) {
      return true;
    }
    return false;
  }
  return false;
}

/** @deprecated Gunakan `memberHasRoomPhaseAccess`. */
export function memberHasCustomProcessPhaseAccess(
  member: RoomMemberProcessAccess,
  customPhaseId: string,
): boolean {
  return memberHasRoomPhaseAccess(member, {
    id: customPhaseId,
    name: "",
    legacyProcessKey: null,
  });
}

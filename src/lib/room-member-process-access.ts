import { RoomMemberRole, type RoomTaskProcess } from "@prisma/client";

/** Nilai enum `RoomMemberRole.ROOM_PROJECT_MANAGER` (aman sebelum `prisma generate`). */
export const ROOM_PROJECT_MANAGER_ROLE =
  "ROOM_PROJECT_MANAGER" as unknown as RoomMemberRole;

export type RoomMemberProcessAccess = {
  role: RoomMemberRole;
  allowedRoomProcesses: RoomTaskProcess[];
};

/** Normalisasi baris anggota ruangan dari Prisma (kolom baru mungkin belum ada di tipe client). */
export function roomMemberToProcessAccess(
  m: { role: RoomMemberRole } & {
    allowedRoomProcesses?: RoomTaskProcess[] | null;
  },
): RoomMemberProcessAccess {
  return {
    role: m.role,
    allowedRoomProcesses: Array.isArray(m.allowedRoomProcesses)
      ? m.allowedRoomProcesses
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

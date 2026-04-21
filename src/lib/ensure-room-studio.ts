import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { Brand, Room, RoomMemberRole, RoomTaskProcess } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdministrator, isStudioOrProjectManager } from "@/lib/roles";
import {
  ROOM_PROJECT_MANAGER_ROLE,
  roomMemberToProcessAccess,
} from "@/lib/room-member-process-access";

export type RoomMemberContext = {
  room: Room & { brand: Brand | null };
  role: RoomMemberRole;
  allowedRoomProcesses: RoomTaskProcess[];
  /** Pengguna yang sedang melihat hub (untuk menghindari pemanggilan `auth()` ganda di halaman anak). */
  viewerUserId: string;
};

/** Akses hub /room/[roomId]/*: CEO atau administrator (semua ruangan), atau tim studio/PM yang terdaftar sebagai anggota. */
export const getRoomMemberContextOrThrow = cache(
  async (roomId: string): Promise<RoomMemberContext> => {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");
    const appRole = session.user.role;
    if (
      appRole !== UserRole.CEO &&
      !isAdministrator(appRole) &&
      !isStudioOrProjectManager(appRole)
    ) {
      redirect("/tasks");
    }

    if (appRole === UserRole.CEO || isAdministrator(appRole)) {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { brand: true },
      });
      if (!room) notFound();
      return {
        room,
        role: ROOM_PROJECT_MANAGER_ROLE,
        allowedRoomProcesses: [],
        viewerUserId: session.user.id,
      };
    }

    const member = await prisma.roomMember.findUnique({
      where: {
        roomId_userId: { roomId, userId: session.user.id },
      },
      include: {
        room: { include: { brand: true } },
      },
    });
    if (!member) {
      redirect("/tasks");
    }
    const { role, allowedRoomProcesses } = roomMemberToProcessAccess(member);
    return {
      room: member.room,
      role,
      allowedRoomProcesses,
      viewerUserId: session.user.id,
    };
  },
);

/** Anggota ruangan untuk nav hub — di-cache per request agar tidak dobel query dengan konteks lain. */
export const getRoomHubMemberUsers = cache(async (roomId: string) => {
  const members = await prisma.roomMember.findMany({
    where: { roomId },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return members.map((m) => m.user);
});

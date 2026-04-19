"use server";

import { revalidatePath } from "next/cache";
import { RoomMemberRole, RoomTaskProcess, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministrator } from "@/lib/auth-helpers";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { ROOM_PROJECT_MANAGER_ROLE } from "@/lib/room-member-process-access";

const roomMemberRoleInput = z.enum([
  "ROOM_MANAGER",
  "ROOM_CONTRIBUTOR",
  "ROOM_PROJECT_MANAGER",
]);

const upsertInputSchema = z.object({
  roomId: z.string().min(1),
  userId: z.string().min(1),
  role: roomMemberRoleInput,
  allowedRoomProcesses: z.array(z.nativeEnum(RoomTaskProcess)).optional(),
});

export async function upsertRoomMember(
  roomId: string,
  userId: string,
  role: RoomMemberRole,
  allowedRoomProcesses?: RoomTaskProcess[],
) {
  await requireAdministrator();
  upsertInputSchema.parse({
    roomId,
    userId,
    role: role as "ROOM_MANAGER" | "ROOM_CONTRIBUTOR" | "ROOM_PROJECT_MANAGER",
    allowedRoomProcesses,
  });

  await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role === UserRole.LOGISTICS) {
    throw new Error("Staf logistik tidak dapat ditambahkan ke ruangan kerja.");
  }
  if (user.role === UserRole.CEO) {
    throw new Error("CEO tidak perlu ditambahkan sebagai anggota ruangan.");
  }

  let processesToStore: RoomTaskProcess[] = [];
  if (role === ROOM_PROJECT_MANAGER_ROLE) {
    processesToStore = [];
  } else {
    if (!allowedRoomProcesses?.length) {
      throw new Error(
        "Pilih minimal satu fase proses untuk manager atau kontributor.",
      );
    }
    processesToStore = allowedRoomProcesses;
  }

  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId, userId } },
    create: {
      roomId,
      userId,
      role,
      allowedRoomProcesses: processesToStore,
    },
    update: {
      role,
      allowedRoomProcesses: processesToStore,
    },
  } as never);
  revalidatePath("/rooms");
  revalidateTasksAndRoomHub();
}

export async function removeRoomMember(roomId: string, userId: string) {
  await requireAdministrator();
  await prisma.roomMember.delete({
    where: { roomId_userId: { roomId, userId } },
  });
  revalidatePath("/rooms");
  revalidateTasksAndRoomHub();
}

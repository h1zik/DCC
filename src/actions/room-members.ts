"use server";

import { revalidatePath } from "next/cache";
import { RoomMemberRole, UserRole, type RoomTaskProcess } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdministratorOrProjectManager } from "@/lib/auth-helpers";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { isSimpleHubRoom } from "@/lib/room-simple-hub";
import { legacyProcessesFromPhaseIds } from "@/lib/room-member-phase-access";
import { ensureRoomProcessPhases } from "@/lib/room-process-phases-seed";
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
  allowedPhaseIds: z.array(z.string().min(1)).optional(),
});

export async function upsertRoomMember(
  roomId: string,
  userId: string,
  role: RoomMemberRole,
  allowedPhaseIds?: string[],
) {
  await requireAdministratorOrProjectManager();
  upsertInputSchema.parse({
    roomId,
    userId,
    role: role as "ROOM_MANAGER" | "ROOM_CONTRIBUTOR" | "ROOM_PROJECT_MANAGER",
    allowedPhaseIds,
  });

  await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role === UserRole.LOGISTICS) {
    throw new Error("Staf logistik tidak dapat ditambahkan ke ruangan kerja.");
  }
  if (user.role === UserRole.FINANCE) {
    throw new Error("Tim finance tidak dapat ditambahkan ke ruangan kerja.");
  }
  if (user.role === UserRole.CEO) {
    throw new Error("CEO tidak perlu ditambahkan sebagai anggota ruangan.");
  }

  const simpleHub = await isSimpleHubRoom(roomId);

  let customIds: string[] = [];
  let legacyProcesses: RoomTaskProcess[] = [];

  if (role === ROOM_PROJECT_MANAGER_ROLE) {
    customIds = [];
    legacyProcesses = [];
  } else if (simpleHub) {
    const phases = await ensureRoomProcessPhases(roomId);
    customIds = phases.map((p) => p.id);
    legacyProcesses = legacyProcessesFromPhaseIds(phases, customIds);
  } else {
    if (!allowedPhaseIds?.length) {
      throw new Error(
        "Pilih minimal satu fase proses untuk administrator atau kontributor ruangan.",
      );
    }
    const phases = await ensureRoomProcessPhases(roomId);
    const valid = new Set(phases.map((p) => p.id));
    customIds = allowedPhaseIds.filter((id) => valid.has(id));
    if (customIds.length === 0) {
      throw new Error("Fase proses tidak valid untuk ruangan ini.");
    }
    legacyProcesses = legacyProcessesFromPhaseIds(phases, customIds);
  }

  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId, userId } },
    create: {
      roomId,
      userId,
      role,
      allowedRoomProcesses: legacyProcesses,
      allowedCustomProcessPhaseIds: customIds,
    },
    update: {
      role,
      allowedRoomProcesses: legacyProcesses,
      allowedCustomProcessPhaseIds: customIds,
    },
  });
  revalidatePath("/rooms");
  revalidatePath(`/room/${roomId}/members`);
  revalidateTasksAndRoomHub();
}

export async function removeRoomMember(roomId: string, userId: string) {
  await requireAdministratorOrProjectManager();
  await prisma.roomMember.delete({
    where: { roomId_userId: { roomId, userId } },
  });
  revalidatePath("/rooms");
  revalidatePath(`/room/${roomId}/members`);
  revalidateTasksAndRoomHub();
}

import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canUseAgent as canUseAgentRole } from "@/lib/roles";
import { assertRoomMember, assertRoomHubManager } from "@/lib/room-access";
import type { AgentUser } from "./types";

export function canUseAgent(user: AgentUser): boolean {
  return canUseAgentRole(user.role as UserRole);
}

export function canSeeAllRooms(user: AgentUser): boolean {
  const role = user.role as UserRole;
  return role === UserRole.CEO || role === UserRole.ADMINISTRATOR;
}

export async function assertAgentRoomAccess(user: AgentUser, roomId: string) {
  if (canSeeAllRooms(user)) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true },
    });
    if (!room) throw new Error("Ruangan tidak ditemukan.");
    return;
  }
  await assertRoomMember(roomId, user.id);
}

export async function assertAgentRoomManager(user: AgentUser, roomId: string) {
  await assertAgentRoomAccess(user, roomId);
  if (!canSeeAllRooms(user)) {
    await assertRoomHubManager(roomId, user.id);
  }
}

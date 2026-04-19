"use server";

import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { assertRoomMember } from "@/lib/room-access";

export async function addRoomMessage(roomId: string, body: string) {
  const session = await requireTasksRoomHubSession();
  const text = body.trim();
  if (!text) throw new Error("Pesan tidak boleh kosong.");

  await assertRoomMember(roomId, session.user.id);
  await prisma.room.findUniqueOrThrow({ where: { id: roomId } });

  await prisma.roomMessage.create({
    data: {
      roomId,
      authorId: session.user.id,
      body: text,
    },
  });
  revalidateTasksAndRoomHub();
}

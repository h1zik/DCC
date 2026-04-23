"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { assertRoomMember } from "@/lib/room-access";
import { assertSafeGifUrl } from "@/lib/room-chat-gif";
import {
  mapRoomMessageToView,
  roomChatMessageInclude,
  type RoomChatMessageView,
} from "@/lib/room-chat-message-view";

const sendMessageSchema = z.object({
  roomId: z.string().min(1),
  body: z.string().max(4000),
  gifUrl: z.string().max(2048).optional(),
  replyToId: z.string().min(1).optional(),
});

export async function addRoomMessage(
  input: z.infer<typeof sendMessageSchema>,
): Promise<RoomChatMessageView> {
  const session = await requireTasksRoomHubSession();
  const data = sendMessageSchema.parse(input);
  const body = data.body.trim();
  const gifRaw = (data.gifUrl ?? "").trim();
  const gifUrl = gifRaw ? assertSafeGifUrl(gifRaw) : null;
  const replyToId = (data.replyToId ?? "").trim() || null;

  if (!body && !gifUrl) {
    throw new Error("Tulis pesan, pilih GIF, atau keduanya.");
  }

  await assertRoomMember(data.roomId, session.user.id);
  await prisma.room.findUniqueOrThrow({ where: { id: data.roomId } });

  if (replyToId) {
    const parent = await prisma.roomMessage.findFirst({
      where: { id: replyToId, roomId: data.roomId },
      select: { id: true },
    });
    if (!parent) {
      throw new Error("Pesan yang dibalas tidak ditemukan.");
    }
  }

  const created = await prisma.roomMessage.create({
    data: {
      roomId: data.roomId,
      authorId: session.user.id,
      body,
      gifUrl,
      replyToId,
    },
    include: roomChatMessageInclude,
  });
  revalidateTasksAndRoomHub();
  return mapRoomMessageToView(created);
}

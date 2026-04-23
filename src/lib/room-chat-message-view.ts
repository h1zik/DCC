import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RoomChatMessageView = {
  id: string;
  body: string;
  gifUrl: string | null;
  replyToId: string | null;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  replyTo: null | {
    id: string;
    body: string;
    gifUrl: string | null;
    author: { name: string | null; email: string };
  };
};

export const roomChatMessageInclude = {
  author: { select: { id: true, name: true, email: true, image: true } },
  replyTo: {
    select: {
      id: true,
      body: true,
      gifUrl: true,
      author: { select: { name: true, email: true } },
    },
  },
} satisfies Prisma.RoomMessageInclude;

export type RoomChatMessageRow = Prisma.RoomMessageGetPayload<{
  include: typeof roomChatMessageInclude;
}>;

export function mapRoomMessageToView(m: RoomChatMessageRow): RoomChatMessageView {
  return {
    id: m.id,
    body: m.body,
    gifUrl: m.gifUrl,
    replyToId: m.replyToId,
    createdAt: m.createdAt.toISOString(),
    author: m.author,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          body: m.replyTo.body,
          gifUrl: m.replyTo.gifUrl,
          author: m.replyTo.author,
        }
      : null,
  };
}

export async function loadRoomChatMessagesForRoom(
  roomId: string,
): Promise<RoomChatMessageView[]> {
  const rows = await prisma.roomMessage.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
    include: roomChatMessageInclude,
  });
  return rows.map(mapRoomMessageToView);
}

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

/**
 * Berapa banyak pesan terakhir yang dimuat saat membuka halaman chat.
 * Polling berikutnya hanya menarik delta menggunakan cursor `?since`,
 * sehingga ruangan dengan ribuan pesan tetap ringan untuk dibuka.
 */
export const ROOM_CHAT_INITIAL_MESSAGE_LIMIT = 200;

/**
 * Pengaman atas — setiap polling delta tidak akan menarik lebih dari ini
 * sekaligus (mencegah spike memori jika ada burst pesan dalam satu detik).
 */
export const ROOM_CHAT_DELTA_MESSAGE_LIMIT = 500;

/**
 * Initial load — terakhir N pesan dari ruangan, dikembalikan dalam urutan
 * waktu menaik (siap render dari atas ke bawah).
 */
export async function loadRoomChatMessagesForRoom(
  roomId: string,
  limit: number = ROOM_CHAT_INITIAL_MESSAGE_LIMIT,
): Promise<RoomChatMessageView[]> {
  const take = Math.max(1, Math.min(limit, ROOM_CHAT_INITIAL_MESSAGE_LIMIT));
  const rows = await prisma.roomMessage.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
    take,
    include: roomChatMessageInclude,
  });
  // Kembalikan ascending untuk konsumsi UI (timeline klasik atas → bawah).
  return rows.map(mapRoomMessageToView).reverse();
}

/**
 * Delta load — pesan dengan `createdAt > since`, ascending. Menggunakan index
 * `RoomMessage(@@index([roomId, createdAt]))` sehingga sangat ringan.
 */
export async function loadRoomChatMessagesSince(
  roomId: string,
  since: Date,
  limit: number = ROOM_CHAT_DELTA_MESSAGE_LIMIT,
): Promise<RoomChatMessageView[]> {
  const take = Math.max(1, Math.min(limit, ROOM_CHAT_DELTA_MESSAGE_LIMIT));
  const rows = await prisma.roomMessage.findMany({
    where: { roomId, createdAt: { gt: since } },
    orderBy: { createdAt: "asc" },
    take,
    include: roomChatMessageInclude,
  });
  return rows.map(mapRoomMessageToView);
}

export async function countRoomChatMessages(roomId: string): Promise<number> {
  return prisma.roomMessage.count({ where: { roomId } });
}

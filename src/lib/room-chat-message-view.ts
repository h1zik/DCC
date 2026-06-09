import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RoomChatAttachmentView = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  publicPath: string;
};

export type RoomChatMessageView = {
  id: string;
  body: string;
  gifUrl: string | null;
  replyToId: string | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  author: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  attachments: RoomChatAttachmentView[];
  replyTo: null | {
    id: string;
    body: string;
    gifUrl: string | null;
    deletedAt: string | null;
    author: { name: string | null; email: string };
    attachmentCount: number;
  };
};

export const roomChatMessageInclude = {
  author: { select: { id: true, name: true, email: true, image: true } },
  attachments: {
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      publicPath: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
  replyTo: {
    select: {
      id: true,
      body: true,
      gifUrl: true,
      deletedAt: true,
      author: { select: { name: true, email: true } },
      _count: { select: { attachments: true } },
    },
  },
} satisfies Prisma.RoomMessageInclude;

export type RoomChatMessageRow = Prisma.RoomMessageGetPayload<{
  include: typeof roomChatMessageInclude;
}>;

export function mapRoomMessageToView(m: RoomChatMessageRow): RoomChatMessageView {
  return {
    id: m.id,
    body: m.deletedAt ? "" : m.body,
    gifUrl: m.deletedAt ? null : m.gifUrl,
    replyToId: m.replyToId,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    editedAt: m.editedAt?.toISOString() ?? null,
    deletedAt: m.deletedAt?.toISOString() ?? null,
    author: m.author,
    attachments: m.deletedAt
      ? []
      : m.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          publicPath: a.publicPath,
        })),
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          body: m.replyTo.deletedAt ? "" : m.replyTo.body,
          gifUrl: m.replyTo.deletedAt ? null : m.replyTo.gifUrl,
          deletedAt: m.replyTo.deletedAt?.toISOString() ?? null,
          author: m.replyTo.author,
          attachmentCount: m.replyTo._count.attachments,
        }
      : null,
  };
}

export function roomMessageActivityMs(m: RoomChatMessageView): number {
  return Math.max(
    new Date(m.createdAt).getTime(),
    new Date(m.updatedAt).getTime(),
  );
}

export function mergeRoomMessageLists(
  prev: RoomChatMessageView[],
  incoming: RoomChatMessageView[],
): RoomChatMessageView[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
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

function channelMessageActivityWhere(channelId: string, since: Date) {
  return {
    channelId,
    OR: [{ createdAt: { gt: since } }, { updatedAt: { gt: since } }],
  };
}

/**
 * Initial load — terakhir N pesan dari sebuah channel, dikembalikan dalam
 * urutan waktu menaik (siap render dari atas ke bawah).
 */
export async function loadRoomChatMessagesForChannel(
  channelId: string,
  limit: number = ROOM_CHAT_INITIAL_MESSAGE_LIMIT,
): Promise<RoomChatMessageView[]> {
  const take = Math.max(1, Math.min(limit, ROOM_CHAT_INITIAL_MESSAGE_LIMIT));
  const rows = await prisma.roomMessage.findMany({
    where: { channelId },
    orderBy: { createdAt: "desc" },
    take,
    include: roomChatMessageInclude,
  });
  return rows.map(mapRoomMessageToView).reverse();
}

/**
 * Delta load — pesan baru atau yang diedit/dihapus setelah `since`, ascending.
 */
export async function loadRoomChatMessagesSinceForChannel(
  channelId: string,
  since: Date,
  limit: number = ROOM_CHAT_DELTA_MESSAGE_LIMIT,
): Promise<RoomChatMessageView[]> {
  const take = Math.max(1, Math.min(limit, ROOM_CHAT_DELTA_MESSAGE_LIMIT));
  const rows = await prisma.roomMessage.findMany({
    where: channelMessageActivityWhere(channelId, since),
    orderBy: { createdAt: "asc" },
    take,
    include: roomChatMessageInclude,
  });
  return rows.map(mapRoomMessageToView);
}

export async function countRoomChatChannelMessages(
  channelId: string,
): Promise<number> {
  return prisma.roomMessage.count({ where: { channelId } });
}

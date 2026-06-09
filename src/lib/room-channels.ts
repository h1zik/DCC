import { prisma } from "@/lib/prisma";

export type RoomChannelView = {
  id: string;
  name: string;
  topic: string | null;
  isDefault: boolean;
  isLocked: boolean;
  sortOrder: number;
  unreadCount: number;
};

export function isRoomChannelProtected(channel: {
  isDefault: boolean;
  isLocked: boolean;
}): boolean {
  return channel.isDefault || channel.isLocked;
}

/** Batas tampilan badge unread (sisanya ditampilkan sebagai "99+"). */
export const ROOM_CHANNEL_UNREAD_CAP = 99;

export function normalizeChannelName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Pastikan ruangan punya channel default `#umum`. Mengembalikan id channel
 * default (dibuat bila belum ada). Aman dipanggil berkali-kali.
 */
export async function ensureRoomDefaultChannel(roomId: string): Promise<string> {
  const existing = await prisma.roomChannel.findFirst({
    where: { roomId, isDefault: true },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });
  if (existing) return existing.id;
  const created = await prisma.roomChannel.create({
    data: { roomId, name: "umum", isDefault: true, isLocked: true, sortOrder: 0 },
    select: { id: true },
  });
  return created.id;
}

/**
 * Validasi bahwa `channelId` (bila ada) milik `roomId`. Bila kosong, kembalikan
 * channel default ruangan. Mengembalikan id channel yang valid.
 */
export async function resolveRoomChannelId(
  roomId: string,
  channelId?: string | null,
): Promise<string> {
  const trimmed = channelId?.trim();
  if (trimmed) {
    const channel = await prisma.roomChannel.findFirst({
      where: { id: trimmed, roomId },
      select: { id: true },
    });
    if (!channel) throw new Error("Channel tidak ditemukan di ruangan ini.");
    return channel.id;
  }
  return ensureRoomDefaultChannel(roomId);
}

/** Channel + jumlah unread untuk seorang user, terurut untuk sidebar. */
export async function listRoomChannelsForUser(
  roomId: string,
  userId: string,
): Promise<RoomChannelView[]> {
  await ensureRoomDefaultChannel(roomId);
  const channels = await prisma.roomChannel.findMany({
    where: { roomId },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      topic: true,
      isDefault: true,
      isLocked: true,
      sortOrder: true,
    },
  });
  if (channels.length === 0) return [];

  const channelIds = channels.map((c) => c.id);
  const reads = await prisma.roomChannelRead.findMany({
    where: { userId, channelId: { in: channelIds } },
    select: { channelId: true, lastReadAt: true },
  });
  const lastReadByChannel = new Map(
    reads.map((r) => [r.channelId, r.lastReadAt]),
  );

  const unreadCounts = await Promise.all(
    channels.map((c) => {
      const lastReadAt = lastReadByChannel.get(c.id) ?? null;
      return prisma.roomMessage.count({
        where: {
          channelId: c.id,
          deletedAt: null,
          authorId: { not: userId },
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        },
      });
    }),
  );

  return channels.map((c, i) => ({
    id: c.id,
    name: c.name,
    topic: c.topic,
    isDefault: c.isDefault,
    isLocked: c.isLocked,
    sortOrder: c.sortOrder,
    unreadCount: unreadCounts[i] ?? 0,
  }));
}

/** Tandai channel sudah dibaca user sampai waktu sekarang. */
export async function markRoomChannelRead(
  channelId: string,
  userId: string,
): Promise<void> {
  const now = new Date();
  await prisma.roomChannelRead.upsert({
    where: { channelId_userId: { channelId, userId } },
    create: { channelId, userId, lastReadAt: now },
    update: { lastReadAt: now },
  });
}

/** Total unread chat ruangan untuk seorang user (semua channel di satu ruangan). */
export async function getRoomUnreadTotal(
  roomId: string,
  userId: string,
): Promise<number> {
  const channels = await listRoomChannelsForUser(roomId, userId);
  return channels.reduce((sum, c) => sum + c.unreadCount, 0);
}

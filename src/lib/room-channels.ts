import { prisma } from "@/lib/prisma";

export type RoomChannelKind = "TEXT" | "VOICE";

export type RoomChannelView = {
  id: string;
  name: string;
  topic: string | null;
  type: RoomChannelKind;
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
 * Pindahkan pesan lama (sebelum fitur channel) ke channel default ruangan.
 * Idempoten — aman dipanggil berkali-kali.
 */
export async function backfillLegacyRoomMessages(
  roomId: string,
  defaultChannelId: string,
): Promise<number> {
  const result = await prisma.roomMessage.updateMany({
    where: { roomId, channelId: null },
    data: { channelId: defaultChannelId },
  });
  return result.count;
}

/**
 * Pastikan ruangan punya channel default `#umum`, lalu tautkan pesan lama
 * (`channelId` null) ke channel tersebut. Mengembalikan id channel default.
 * Aman dipanggil berkali-kali — dipakai otomatis saat chat dibuka / deploy.
 */
export async function ensureRoomDefaultChannel(roomId: string): Promise<string> {
  let channel = await prisma.roomChannel.findFirst({
    where: { roomId, isDefault: true },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!channel) {
    channel = await prisma.roomChannel.create({
      data: {
        roomId,
        name: "umum",
        isDefault: true,
        isLocked: true,
        sortOrder: 0,
      },
      select: { id: true },
    });
  }

  await backfillLegacyRoomMessages(roomId, channel.id);
  return channel.id;
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
    // Channel VOICE bukan target chat — jatuhkan ke channel default.
    const channel = await prisma.roomChannel.findFirst({
      where: { id: trimmed, roomId, type: "TEXT" },
      select: { id: true },
    });
    if (channel) return channel.id;
    // Bookmark / link lama setelah migrasi channel — arahkan ke #umum.
    return ensureRoomDefaultChannel(roomId);
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
      type: true,
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
      // Channel VOICE tidak punya pesan/unread.
      if (c.type === "VOICE") return Promise.resolve(0);
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
    type: c.type,
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

import "server-only";
import { unstable_cache } from "next/cache";
import { Prisma, RoomWorkspaceSection, TaskStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSimpleTeamOrHqRoom } from "@/lib/room-simple-hub";
import { isAdministrator, isStudioOrProjectManager } from "@/lib/roles";
import { isRoomHubManagerRole } from "@/lib/room-member-process-access";
import type { RoomNavCustomView } from "@/lib/room-nav-links";

/** Ruangan yang dipakai dropdown "Tugas & Kanban" di sidebar (serializable). */
export type NavRoom = {
  id: string;
  name: string;
  logoImage: string | null;
  brandColor: string | null;
  section: RoomWorkspaceSection;
  simpleHub: boolean;
  /** Jumlah tugas aktif (belum diarsip & belum selesai). */
  openTaskCount: number;
  /** Total pesan chat belum dibaca viewer di seluruh channel ruangan. */
  unreadChatCount: number;
  /** Viewer manager/PM ruangan — boleh menambah view (quick-add). */
  canManageRoom: boolean;
  customViews: RoomNavCustomView[];
};

/** Peran yang memiliki menu Tugas & Kanban (CEO, administrator, studio/PM). */
export function roleHasTasksNav(role: UserRole | undefined): boolean {
  if (!role) return false;
  return (
    role === UserRole.CEO ||
    isAdministrator(role) ||
    isStudioOrProjectManager(role)
  );
}

/**
 * Tag cache struktur navigasi ruangan. Revalidate saat CRUD ruangan/view/
 * keanggotaan; jumlah tugas terbuka cukup mengikuti revalidate berkala.
 */
export const NAV_ROOMS_CACHE_TAG = "nav-rooms";

/**
 * Struktur navigasi (ruangan + view + peran + jumlah tugas) — di-cache lintas
 * request karena dimuat layout dashboard di SETIAP navigasi & router.refresh().
 * `unreadChatCount` selalu 0 di sini; angka live dilayani terpisah (endpoint
 * unread) supaya jalur cache tidak ikut query pesan.
 */
export function getNavRoomStructure(
  userId: string,
  role: UserRole,
): Promise<NavRoom[]> {
  return unstable_cache(
    () => loadNavRoomStructure(userId, role),
    ["nav-room-structure", userId, role],
    {
      tags: [NAV_ROOMS_CACHE_TAG, `${NAV_ROOMS_CACHE_TAG}:${userId}`],
      revalidate: 120,
    },
  )();
}

/**
 * Memuat ruangan yang dapat diakses pengguna beserta custom view-nya beserta
 * jumlah chat belum dibaca (live). CEO & administrator melihat semua ruangan;
 * peran lain hanya ruangan tempat mereka menjadi anggota.
 */
export async function getNavRooms(
  userId: string,
  role: UserRole,
): Promise<NavRoom[]> {
  const rooms = await getNavRoomStructure(userId, role);
  if (rooms.length === 0) return rooms;

  const unreadByRoom = await getUnreadChatByRoom(
    userId,
    rooms.map((r) => r.id),
  );
  return rooms.map((r) => ({
    ...r,
    unreadChatCount: unreadByRoom.get(r.id) ?? 0,
  }));
}

async function loadNavRoomStructure(
  userId: string,
  role: UserRole,
): Promise<NavRoom[]> {
  if (!roleHasTasksNav(role)) return [];

  const isGlobalManager = role === UserRole.CEO || isAdministrator(role);
  const rooms = await prisma.room.findMany({
    where: isGlobalManager ? {} : { members: { some: { userId } } },
    select: {
      id: true,
      name: true,
      logoImage: true,
      brandId: true,
      workspaceSection: true,
      brand: { select: { colorCode: true } },
      members: { where: { userId }, select: { role: true } },
      views: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, type: true, title: true },
      },
      projects: {
        select: {
          _count: {
            select: {
              tasks: {
                where: { archivedAt: null, status: { not: TaskStatus.DONE } },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return rooms.map((r) => {
    const openTaskCount = r.projects.reduce(
      (sum, p) => sum + p._count.tasks,
      0,
    );
    const memberRole = r.members[0]?.role;
    const canManageRoom =
      isGlobalManager ||
      (memberRole ? isRoomHubManagerRole(memberRole) : false);

    return {
      id: r.id,
      name: r.name,
      logoImage: r.logoImage ?? null,
      brandColor: r.brand?.colorCode ?? null,
      section: r.workspaceSection,
      simpleHub: isSimpleTeamOrHqRoom({
        brandId: r.brandId,
        workspaceSection: r.workspaceSection,
      }),
      openTaskCount,
      unreadChatCount: 0,
      canManageRoom,
      customViews: r.views,
    };
  });
}

/**
 * Hitung total pesan chat belum dibaca per ruangan untuk seorang user dalam
 * SATU query (skala aman) — gabungkan pesan dengan `RoomChannelRead.lastReadAt`
 * per channel, lalu kelompokkan per ruangan.
 */
export async function getUnreadChatByRoom(
  userId: string,
  roomIds: string[],
): Promise<Map<string, number>> {
  if (roomIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<{ roomId: string; unread: number }[]>(
    Prisma.sql`
      SELECT ch."roomId" AS "roomId", COUNT(*)::int AS "unread"
      FROM "RoomMessage" m
      JOIN "RoomChannel" ch ON ch."id" = m."channelId"
      LEFT JOIN "RoomChannelRead" rd
        ON rd."channelId" = m."channelId" AND rd."userId" = ${userId}
      WHERE ch."roomId" IN (${Prisma.join(roomIds)})
        AND m."deletedAt" IS NULL
        AND m."authorId" <> ${userId}
        AND (rd."lastReadAt" IS NULL OR m."createdAt" > rd."lastReadAt")
      GROUP BY ch."roomId"
    `,
  );
  return new Map(rows.map((r) => [r.roomId, Number(r.unread)]));
}

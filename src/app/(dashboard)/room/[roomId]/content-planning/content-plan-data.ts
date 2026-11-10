import "server-only";

import { prisma } from "@/lib/prisma";
import { contentPlanTaskKindOrDefault } from "@/lib/content-plan-task-kind";
import type { ContentPlanFeedDefaults } from "./content-plan-feed";

type RoomForContentPlan = {
  name: string;
  logoImage?: string | null;
  brand?: { name: string; logo?: string | null } | null;
};

/**
 * Data satu content plan untuk `ContentPlanningClient`. `viewId` null = content
 * plan bawaan ruangan; terisi = view tambahan bertipe CONTENT_PLAN. Dipakai
 * halaman `/content-planning` dan `/view/[viewId]` supaya keduanya identik.
 */
export async function loadContentPlanData(
  roomId: string,
  viewId: string | null,
  room: RoomForContentPlan,
) {
  const [items, memberRows, projects, feedProfileRow] = await Promise.all([
    prisma.roomContentPlanItem.findMany({
      where: { roomId, viewId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        pic: { select: { id: true, name: true, email: true, image: true } },
        // Tugas Kanban aktif per baris: dipakai UI untuk tahu sisi mana (copy/
        // design) yang sudah punya tugas sehingga tidak ditawarkan lagi.
        tasksFromContentPlan: {
          where: { archivedAt: null },
          select: { contentPlanKind: true },
        },
      },
    }),
    prisma.roomMember.findMany({
      where: { roomId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.project.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
    prisma.roomContentPlanFeedProfile.findFirst({
      where: { roomId, viewId },
      orderBy: { createdAt: "asc" },
      select: {
        username: true,
        displayName: true,
        bio: true,
        avatarPath: true,
        followersLabel: true,
        followingLabel: true,
        includeArchived: true,
        instagramOnly: true,
        includeUndated: true,
      },
    }),
  ]);

  const rows = items.map(({ tasksFromContentPlan, ...row }) => ({
    ...row,
    kanbanTaskKinds: [
      ...new Set(
        tasksFromContentPlan.map((t) => contentPlanTaskKindOrDefault(t.contentPlanKind)),
      ),
    ],
  }));

  /** Simulasi feed: identitas awal diambil dari brand ruangan (fallback nama ruangan). */
  const feedDefaults: ContentPlanFeedDefaults = {
    username: room.brand?.name?.trim() || room.name,
    displayName: room.brand?.name?.trim() || room.name,
    avatarPath: room.logoImage ?? room.brand?.logo ?? null,
  };

  return {
    items: rows,
    picUserOptions: memberRows.map((m) => m.user),
    kanbanProjectId: projects[0]?.id ?? null,
    feedProfile: feedProfileRow,
    feedDefaults,
  };
}

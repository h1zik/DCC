"use server";

import { rm, unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { RoomViewType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomHubManager } from "@/lib/room-access";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { ROOM_VIEW_TYPE_META } from "@/lib/room-view-meta";
import {
  absolutePathFromStoredPublicPath,
  getUploadPublicDir,
} from "@/lib/upload-storage";

const titleSchema = z.string().trim().min(1).max(80);
const subtitleSchema = z.string().trim().max(160).optional().nullable();

const createSchema = z.object({
  roomId: z.string().min(1),
  type: z.nativeEnum(RoomViewType),
  title: z.string().trim().min(1).max(80).optional(),
  subtitle: subtitleSchema,
});

async function getViewRoomIdOrThrow(viewId: string): Promise<string> {
  const v = await prisma.roomView.findUniqueOrThrow({
    where: { id: viewId },
    select: { roomId: true },
  });
  return v.roomId;
}

export async function createRoomView(input: z.infer<typeof createSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = createSchema.parse(input);
  await assertRoomHubManager(data.roomId, session.user.id);

  const max = await prisma.roomView.aggregate({
    where: { roomId: data.roomId },
    _max: { sortOrder: true },
  });
  const meta = ROOM_VIEW_TYPE_META[data.type];
  const created = await prisma.roomView.create({
    data: {
      roomId: data.roomId,
      type: data.type,
      title: data.title?.trim() || meta.defaultTitle,
      subtitle: data.subtitle?.trim() || null,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    select: { id: true, roomId: true },
  });

  if (data.type === RoomViewType.LIST) {
    await prisma.roomListColumn.createMany({
      data: [
        { viewId: created.id, key: "title", label: "Judul", type: "TEXT", sortOrder: 0 },
        { viewId: created.id, key: "status", label: "Status", type: "TEXT", sortOrder: 1 },
        { viewId: created.id, key: "catatan", label: "Catatan", type: "TEXT", sortOrder: 2 },
      ],
    });
  }

  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${data.roomId}`);
  return { id: created.id };
}

const renameSchema = z.object({
  viewId: z.string().min(1),
  title: titleSchema,
  subtitle: subtitleSchema,
});

export async function renameRoomView(input: z.infer<typeof renameSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = renameSchema.parse(input);
  const roomId = await getViewRoomIdOrThrow(data.viewId);
  await assertRoomHubManager(roomId, session.user.id);
  await prisma.roomView.update({
    where: { id: data.viewId },
    data: { title: data.title, subtitle: data.subtitle?.trim() || null },
  });
  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${roomId}`);
  revalidatePath(`/room/${roomId}/view/${data.viewId}`);
}

/**
 * File unggahan milik view Content Plan (folder per baris + avatar profil feed).
 * Dikumpulkan sebelum view dihapus karena baris & profilnya ikut ter-cascade.
 */
async function collectContentPlanViewFiles(viewId: string) {
  const [items, profile] = await Promise.all([
    prisma.roomContentPlanItem.findMany({ where: { viewId }, select: { id: true } }),
    prisma.roomContentPlanFeedProfile.findUnique({
      where: { viewId },
      select: { avatarPath: true },
    }),
  ]);
  return { itemIds: items.map((i) => i.id), avatarPath: profile?.avatarPath ?? null };
}

/** Best-effort: kegagalan menghapus file tidak membatalkan penghapusan view. */
async function removeContentPlanViewFiles(files: {
  itemIds: string[];
  avatarPath: string | null;
}) {
  const baseDir = path.join(getUploadPublicDir(), "room-content-plan");
  for (const itemId of files.itemIds) {
    try {
      await rm(path.join(baseDir, itemId), { recursive: true, force: true });
    } catch {
      /* folder sudah hilang / terkunci */
    }
  }
  if (files.avatarPath?.startsWith("/uploads/room-content-plan-feed/")) {
    const abs = absolutePathFromStoredPublicPath(files.avatarPath);
    try {
      if (abs) await unlink(abs);
    } catch {
      /* sudah hilang */
    }
  }
}

export async function deleteRoomView(viewId: string) {
  const session = await requireTasksRoomHubSession();
  const view = await prisma.roomView.findUniqueOrThrow({
    where: { id: viewId },
    select: { roomId: true, type: true },
  });
  const roomId = view.roomId;
  await assertRoomHubManager(roomId, session.user.id);
  const contentPlanFiles =
    view.type === RoomViewType.CONTENT_PLAN
      ? await collectContentPlanViewFiles(viewId)
      : null;
  await prisma.roomView.delete({ where: { id: viewId } });
  if (contentPlanFiles) await removeContentPlanViewFiles(contentPlanFiles);
  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${roomId}`);
}

const reorderSchema = z.object({
  roomId: z.string().min(1),
  orderedViewIds: z.array(z.string().min(1)).min(1),
});

export async function reorderRoomViews(input: z.infer<typeof reorderSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = reorderSchema.parse(input);
  await assertRoomHubManager(data.roomId, session.user.id);
  const existing = await prisma.roomView.findMany({
    where: { roomId: data.roomId },
    select: { id: true },
  });
  const valid = new Set(existing.map((v) => v.id));
  if (data.orderedViewIds.some((id) => !valid.has(id))) {
    throw new Error("Urutan view tidak valid.");
  }
  await prisma.$transaction(
    data.orderedViewIds.map((id, i) =>
      prisma.roomView.update({ where: { id }, data: { sortOrder: i } }),
    ),
  );
  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${data.roomId}`);
}

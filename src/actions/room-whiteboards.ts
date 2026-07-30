"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import {
  assertWhiteboardAccess,
  assertWhiteboardViewAccess,
} from "@/lib/whiteboard/board-access";
import { WHITEBOARD_BACKGROUNDS } from "@/lib/whiteboard/types";

/**
 * Pengelolaan papan whiteboard (bukan isi kanvasnya).
 *
 * Isi kanvas disinkronkan lewat route handler `/api/rooms/.../whiteboards/...`
 * karena frekuensinya tinggi dan tidak boleh memicu revalidasi halaman.
 * Server action di sini hanya untuk operasi tingkat papan yang jarang terjadi.
 */

const titleSchema = z.string().trim().min(1).max(120);

function revalidateBoard(roomId: string, viewId: string) {
  revalidatePath(`/room/${roomId}/view/${viewId}`);
}

export async function createRoomWhiteboard(input: {
  viewId: string;
  title?: string;
}) {
  const session = await requireTasksRoomHubSession();
  const viewId = z.string().min(1).parse(input.viewId);
  const { roomId } = await assertWhiteboardViewAccess(viewId, session.user.id);

  const [max, count] = await Promise.all([
    prisma.roomWhiteboard.aggregate({
      where: { viewId },
      _max: { sortOrder: true },
    }),
    prisma.roomWhiteboard.count({ where: { viewId } }),
  ]);

  const title = input.title?.trim()
    ? titleSchema.parse(input.title)
    : `Papan ${count + 1}`;

  const board = await prisma.roomWhiteboard.create({
    data: {
      viewId,
      title,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
      createdById: session.user.id,
      lastEditedById: session.user.id,
      lastEditedAt: new Date(),
    },
    select: { id: true },
  });

  revalidateBoard(roomId, viewId);
  return { id: board.id };
}

export async function renameRoomWhiteboard(input: {
  boardId: string;
  title: string;
}) {
  const session = await requireTasksRoomHubSession();
  const title = titleSchema.parse(input.title);
  const { roomId, viewId } = await assertWhiteboardAccess(
    input.boardId,
    session.user.id,
  );

  await prisma.roomWhiteboard.update({
    where: { id: input.boardId },
    data: { title },
  });

  revalidateBoard(roomId, viewId);
}

export async function setRoomWhiteboardBackground(input: {
  boardId: string;
  background: string;
}) {
  const session = await requireTasksRoomHubSession();
  const background = z.enum(WHITEBOARD_BACKGROUNDS).parse(input.background);
  const { roomId, viewId } = await assertWhiteboardAccess(
    input.boardId,
    session.user.id,
  );

  await prisma.roomWhiteboard.update({
    where: { id: input.boardId },
    data: { background },
  });

  revalidateBoard(roomId, viewId);
}

const MAX_ELEMENTS_PER_BOARD = 10_000;

export async function duplicateRoomWhiteboard(input: { boardId: string }) {
  const session = await requireTasksRoomHubSession();
  const { roomId, viewId } = await assertWhiteboardAccess(
    input.boardId,
    session.user.id,
  );

  const source = await prisma.roomWhiteboard.findUniqueOrThrow({
    where: { id: input.boardId },
    select: { title: true, background: true, thumbnail: true },
  });
  const elements = await prisma.roomWhiteboardElement.findMany({
    where: { boardId: input.boardId, deletedAt: null },
    take: MAX_ELEMENTS_PER_BOARD,
  });

  const max = await prisma.roomWhiteboard.aggregate({
    where: { viewId },
    _max: { sortOrder: true },
  });

  // Id elemen dibuat ulang, tetapi referensi antar elemen (frame induk &
  // ujung konektor) harus ikut dipetakan ke id barunya.
  const idMap = new Map<string, string>();
  for (const el of elements) {
    idMap.set(el.id, crypto.randomUUID());
  }

  const created = await prisma.$transaction(async (tx) => {
    const board = await tx.roomWhiteboard.create({
      data: {
        viewId,
        title: `${source.title} (salinan)`.slice(0, 120),
        background: source.background,
        thumbnail: source.thumbnail,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
        rev: 1,
        createdById: session.user.id,
        lastEditedById: session.user.id,
        lastEditedAt: new Date(),
      },
      select: { id: true },
    });

    if (elements.length > 0) {
      await tx.roomWhiteboardElement.createMany({
        data: elements.map((el) => ({
          id: idMap.get(el.id)!,
          boardId: board.id,
          type: el.type,
          zIndex: el.zIndex,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation,
          props: remapProps(el.props, idMap),
          locked: el.locked,
          frameId: el.frameId ? (idMap.get(el.frameId) ?? null) : null,
          rev: 1,
          createdById: session.user.id,
          updatedById: session.user.id,
        })),
      });
    }

    return board;
  });

  revalidateBoard(roomId, viewId);
  return { id: created.id };
}

/** Petakan ulang `start.elementId` / `end.elementId` konektor ke id salinan. */
function remapProps(
  props: unknown,
  idMap: Map<string, string>,
): Prisma.InputJsonValue {
  if (!props || typeof props !== "object") return {};
  const clone = { ...(props as Record<string, unknown>) };
  for (const key of ["start", "end"] as const) {
    const endpoint = clone[key];
    if (!endpoint || typeof endpoint !== "object") continue;
    const e = { ...(endpoint as Record<string, unknown>) };
    const linked = typeof e.elementId === "string" ? e.elementId : null;
    // Kalau elemen yang ditempeli tidak ikut disalin, lepaskan tempelannya
    // agar konektor tidak menunjuk ke papan lain.
    e.elementId = linked ? (idMap.get(linked) ?? null) : null;
    clone[key] = e;
  }
  return clone as Prisma.InputJsonValue;
}

export async function deleteRoomWhiteboard(input: { boardId: string }) {
  const session = await requireTasksRoomHubSession();
  const { roomId, viewId } = await assertWhiteboardAccess(
    input.boardId,
    session.user.id,
  );

  await prisma.roomWhiteboard.delete({ where: { id: input.boardId } });

  revalidateBoard(roomId, viewId);
}

export async function reorderRoomWhiteboards(input: {
  viewId: string;
  orderedIds: string[];
}) {
  const session = await requireTasksRoomHubSession();
  const { roomId, viewId } = await assertWhiteboardViewAccess(
    input.viewId,
    session.user.id,
  );
  const ids = z.array(z.string().min(1)).max(500).parse(input.orderedIds);

  const owned = await prisma.roomWhiteboard.findMany({
    where: { viewId, id: { in: ids } },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((b) => b.id));

  await prisma.$transaction(
    ids
      .filter((id) => ownedIds.has(id))
      .map((id, index) =>
        prisma.roomWhiteboard.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
  );

  revalidateBoard(roomId, viewId);
}

/**
 * Simpan pratinjau papan. Dipanggil dari klien secara throttled setelah
 * kanvas berubah, jadi sengaja tidak memicu revalidasi.
 */
export async function saveRoomWhiteboardThumbnail(input: {
  boardId: string;
  thumbnail: string;
}) {
  const session = await requireTasksRoomHubSession();
  await assertWhiteboardAccess(input.boardId, session.user.id);

  const thumbnail = input.thumbnail.trim();
  // Batasi ke data URL PNG/JPEG/WEBP berukuran wajar (~200 KB base64).
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(thumbnail)) {
    throw new Error("Format pratinjau tidak valid.");
  }
  if (thumbnail.length > 280_000) {
    throw new Error("Pratinjau terlalu besar.");
  }

  await prisma.roomWhiteboard.update({
    where: { id: input.boardId },
    data: { thumbnail },
  });
}

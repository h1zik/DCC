import "server-only";

import { RoomViewType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertRoomMember } from "@/lib/room-access";

/**
 * Pemeriksaan akses papan whiteboard.
 *
 * Semua papan hidup di bawah sebuah view bertipe `WHITEBOARD`, yang hidup di
 * bawah sebuah ruangan. Jadi haknya sama dengan hak keanggotaan ruangan:
 * siapa pun anggota ruangan boleh melihat & menyunting papan, sementara
 * pengelolaan view (tambah/hapus view) tetap milik manager ruangan.
 */

export type WhiteboardContext = {
  boardId: string;
  viewId: string;
  roomId: string;
};

export async function assertWhiteboardViewAccess(
  viewId: string,
  userId: string,
): Promise<{ viewId: string; roomId: string }> {
  const view = await prisma.roomView.findUnique({
    where: { id: viewId },
    select: { id: true, roomId: true, type: true },
  });
  if (!view) throw new Error("View tidak ditemukan.");
  if (view.type !== RoomViewType.WHITEBOARD) {
    throw new Error("View bukan tipe Whiteboard.");
  }
  await assertRoomMember(view.roomId, userId);
  return { viewId: view.id, roomId: view.roomId };
}

export async function assertWhiteboardAccess(
  boardId: string,
  userId: string,
): Promise<WhiteboardContext> {
  const board = await prisma.roomWhiteboard.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      viewId: true,
      view: { select: { roomId: true, type: true } },
    },
  });
  if (!board) throw new Error("Papan tidak ditemukan.");
  if (board.view.type !== RoomViewType.WHITEBOARD) {
    throw new Error("View bukan tipe Whiteboard.");
  }
  await assertRoomMember(board.view.roomId, userId);
  return {
    boardId: board.id,
    viewId: board.viewId,
    roomId: board.view.roomId,
  };
}

/**
 * Versi non-throwing untuk route handler, supaya bisa membalas 403/404 yang
 * rapi alih-alih melempar error 500.
 */
export async function resolveWhiteboardAccess(
  boardId: string,
  userId: string,
): Promise<
  | { ok: true; context: WhiteboardContext }
  | { ok: false; status: 403 | 404; message: string }
> {
  const board = await prisma.roomWhiteboard.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      viewId: true,
      view: { select: { roomId: true, type: true } },
    },
  });
  if (!board || board.view.type !== RoomViewType.WHITEBOARD) {
    return { ok: false, status: 404, message: "Papan tidak ditemukan." };
  }
  try {
    await assertRoomMember(board.view.roomId, userId);
  } catch {
    return { ok: false, status: 403, message: "Anda bukan anggota ruangan ini." };
  }
  return {
    ok: true,
    context: {
      boardId: board.id,
      viewId: board.viewId,
      roomId: board.view.roomId,
    },
  };
}

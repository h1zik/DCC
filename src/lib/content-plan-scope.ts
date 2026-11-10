import { revalidatePath } from "next/cache";
import { RoomViewType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Satu ruangan bisa punya beberapa content plan: yang bawaan (menu
 * "Content Plan", `viewId` null) dan view tambahan bertipe CONTENT_PLAN.
 * Baris & profil feed di-scope lewat pasangan (roomId, viewId).
 */

/** Halaman tempat sebuah content plan dibuka. */
export function contentPlanHref(roomId: string, viewId: string | null | undefined): string {
  return viewId ? `/room/${roomId}/view/${viewId}` : `/room/${roomId}/content-planning`;
}

/**
 * Normalisasi + validasi `viewId` kiriman klien: kosong = content plan bawaan;
 * terisi harus view CONTENT_PLAN milik ruangan yang sama.
 */
export async function resolveContentPlanViewId(
  roomId: string,
  viewId: string | null | undefined,
): Promise<string | null> {
  if (!viewId) return null;
  const view = await prisma.roomView.findUnique({
    where: { id: viewId },
    select: { roomId: true, type: true },
  });
  if (!view || view.roomId !== roomId || view.type !== RoomViewType.CONTENT_PLAN) {
    throw new Error("Content plan tidak ditemukan di ruangan ini.");
  }
  return viewId;
}

/** Segarkan semua halaman ruangan (content plan bawaan maupun view tambahan). */
export function revalidateContentPlan(roomId: string) {
  revalidatePath(`/room/${roomId}`, "layout");
}

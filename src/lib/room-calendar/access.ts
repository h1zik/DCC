import "server-only";

import { prisma } from "@/lib/prisma";
import { assertRoomMember } from "@/lib/room-access";

/**
 * Semua anggota ruangan boleh menulis ke kalender. Pemanggil mencari view dari
 * baris yang disentuh (bukan dari `viewId` kiriman klien), lalu memeriksa
 * keanggotaan di ruangan view itu. Dipakai server action dan route handler.
 */
export async function ensureCalendarViewMember(viewId: string, userId: string) {
  const v = await prisma.roomView.findUniqueOrThrow({
    where: { id: viewId },
    select: { roomId: true, type: true },
  });
  if (v.type !== "CALENDAR") throw new Error("View bukan tipe Kalender.");
  await assertRoomMember(v.roomId, userId);
  return v.roomId;
}

/** Keanggotaan diperiksa di ruangan tempat campaign berada. */
export async function ensureCampaignMember(campaignId: string, userId: string) {
  const campaign = await prisma.roomCampaign.findUnique({
    where: { id: campaignId },
    select: { viewId: true },
  });
  if (!campaign) throw new Error("Campaign tidak ditemukan.");
  const roomId = await ensureCalendarViewMember(campaign.viewId, userId);
  return { viewId: campaign.viewId, roomId };
}

/** Status HTTP untuk pesan error dari helper auth/akses di atas. */
export function calendarAccessErrorStatus(message: string, fallback: number): number {
  if (message.includes("Belum masuk")) return 401;
  if (message.includes("bukan anggota") || message.includes("dapat melakukan")) return 403;
  if (message.includes("tidak ditemukan")) return 404;
  return fallback;
}

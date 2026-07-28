import { prisma } from "@/lib/prisma";
import type { RoomTaskGroupRef } from "@/lib/room-task-group";

/**
 * Kelompok tugas ruangan non-brand, terurut sesuai tab.
 *
 * TIDAK menyeed apa pun — ruangan yang belum punya kelompok mengembalikan
 * array kosong, dan halaman Tasks-nya tampil tanpa tab seperti sebelumnya.
 *
 * Baris ber-`legacyProcessKey` (sisa fase bawaan dari masa ruangan ini masih
 * terikat brand — `updateRoom` mengizinkan brand dilepas) SENGAJA ikut
 * terdaftar. Kalau disaring, tugas yang masih menunjuk baris itu tidak akan
 * muncul di tab mana pun: bukan di "Umum" (karena `customProcessPhaseId`-nya
 * tidak null) dan tidak punya tab sendiri. Manager bisa menamai ulang atau
 * menghapusnya lewat dialog kelola kelompok.
 */
export async function listRoomTaskGroups(
  roomId: string,
): Promise<RoomTaskGroupRef[]> {
  return prisma.roomCustomProcessPhase.findMany({
    where: { roomId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

/** Validasi bahwa sebuah id kelompok benar milik ruangan ini. */
export async function findRoomTaskGroup(
  roomId: string,
  groupId: string,
): Promise<RoomTaskGroupRef | null> {
  return prisma.roomCustomProcessPhase.findFirst({
    where: { id: groupId, roomId },
    select: { id: true, name: true },
  });
}

/**
 * Kelompok tugas di ruangan non-brand (HQ/Team) — tab pemilih di atas papan.
 *
 * Penyimpanannya memakai tabel yang sama dengan fase proses ruangan brand
 * (`RoomCustomProcessPhase`, baris tanpa `legacyProcessKey`), jadi seluruh
 * filter tugas yang sudah ada tetap jalan lewat `Task.customProcessPhaseId`.
 * Dua perbedaan penting dari fase:
 *
 * 1. TIDAK ada kelompok bawaan. `ensureRoomProcessPhases()` sengaja tidak
 *    pernah dipanggil untuk ruangan non-brand — fungsi itu menulis ulang
 *    `customProcessPhaseId` pada tugas yang sudah ada.
 * 2. Kolom Kanban TIDAK dipecah per kelompok. Satu ruangan = satu set kolom
 *    (lihat `getSimpleHubKanbanColumns`), supaya tampilan lintas kelompok
 *    (List, Gantt, Kalender) memakai status yang sejajar.
 *
 * Modul ini sengaja bebas Prisma — dipakai juga oleh komponen client.
 * Query DB-nya ada di `room-task-groups-query.ts`.
 */
export type RoomTaskGroupRef = {
  id: string;
  name: string;
};

/** Tab tugas yang belum dikelompokkan. Turunan, bukan baris DB. */
export const ROOM_TASK_GROUP_UNGROUPED_LABEL = "Umum";

/**
 * Parse query `group`. Kosong = tab "Umum" (sah). Id yang tidak dikenal
 * ditandai `valid: false` supaya pemanggil bisa redirect ke URL bersih
 * ketimbang diam-diam menampilkan papan yang salah.
 */
export function parseRoomTaskGroupParam(
  raw: string | string[] | undefined | null,
  groups: RoomTaskGroupRef[],
): { group: RoomTaskGroupRef | null; valid: boolean } {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!value) return { group: null, valid: true };

  const found = groups.find((g) => g.id === value);
  if (!found) return { group: null, valid: false };
  return { group: found, valid: true };
}

/**
 * Filter tugas per kelompok aktif.
 *
 * Sengaja TIDAK memakai `taskPhaseWhere()`: helper itu ikut memfilter
 * `roomProcess` untuk fase legacy, sedangkan tab "Umum" harus memuat semua
 * tugas tanpa kelompok berapa pun nilai `roomProcess`-nya.
 */
export function roomTaskGroupWhere(group: RoomTaskGroupRef | null) {
  return { customProcessPhaseId: group ? group.id : null };
}

/** URL papan tugas ruangan untuk kelompok tertentu (`null` = Umum). */
export function roomTaskGroupHref(
  roomId: string,
  group: RoomTaskGroupRef | null,
  opts: { showArchived?: boolean } = {},
): string {
  const qs = new URLSearchParams();
  if (group) qs.set("group", group.id);
  if (opts.showArchived) qs.set("archived", "1");
  const query = qs.toString();
  return `/room/${roomId}/tasks${query ? `?${query}` : ""}`;
}

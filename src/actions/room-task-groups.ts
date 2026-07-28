"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomHubManager, assertRoomMember } from "@/lib/room-access";
import { isSimpleHubRoom } from "@/lib/room-simple-hub";
import { listRoomTaskGroups } from "@/lib/room-task-groups-query";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import type { RoomTaskGroupRef } from "@/lib/room-task-group";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Nama kelompok wajib diisi.")
  .max(80);

/**
 * Kelompok hanya berlaku di ruangan non-brand. Guard ini kebalikan dari
 * `room-custom-process-phases.ts` supaya kedua konsep tidak pernah tercampur
 * dalam satu ruangan — ruangan brand memakai fase, ruangan non-brand memakai
 * kelompok, tidak pernah dua-duanya.
 */
async function assertGroupRoom(roomId: string): Promise<void> {
  if (!(await isSimpleHubRoom(roomId))) {
    throw new Error("Ruangan ini memakai fase proses, bukan kelompok tugas.");
  }
}

export async function fetchRoomTaskGroups(
  roomId: string,
): Promise<RoomTaskGroupRef[]> {
  const session = await requireTasksRoomHubSession();
  await assertRoomMember(roomId, session.user.id);
  await assertGroupRoom(roomId);
  return listRoomTaskGroups(roomId);
}

export async function createRoomTaskGroup(input: {
  roomId: string;
  name: string;
}): Promise<RoomTaskGroupRef> {
  const session = await requireTasksRoomHubSession();
  const name = nameSchema.parse(input.name);
  await assertGroupRoom(input.roomId);
  await assertRoomHubManager(input.roomId, session.user.id);

  const max = await prisma.roomCustomProcessPhase.aggregate({
    where: { roomId: input.roomId },
    _max: { sortOrder: true },
  });

  // Kolom Kanban SENGAJA tidak diseed di sini: seluruh ruangan berbagi satu
  // set kolom (`getSimpleHubKanbanColumns`), tidak dipecah per kelompok.
  const created = await prisma.roomCustomProcessPhase.create({
    data: {
      roomId: input.roomId,
      name,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
      legacyProcessKey: null,
    },
    select: { id: true, name: true },
  });

  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${input.roomId}/tasks`);
  return created;
}

export async function renameRoomTaskGroup(input: {
  groupId: string;
  name: string;
}): Promise<RoomTaskGroupRef> {
  const session = await requireTasksRoomHubSession();
  const name = nameSchema.parse(input.name);
  const group = await prisma.roomCustomProcessPhase.findUniqueOrThrow({
    where: { id: input.groupId },
    select: { roomId: true },
  });
  await assertGroupRoom(group.roomId);
  await assertRoomHubManager(group.roomId, session.user.id);

  const updated = await prisma.roomCustomProcessPhase.update({
    where: { id: input.groupId },
    data: { name },
    select: { id: true, name: true },
  });

  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${group.roomId}/tasks`);
  return updated;
}

const reorderSchema = z.object({
  roomId: z.string().min(1),
  orderedGroupIds: z.array(z.string().min(1)).min(1),
});

export async function reorderRoomTaskGroups(
  input: z.infer<typeof reorderSchema>,
): Promise<void> {
  const session = await requireTasksRoomHubSession();
  const data = reorderSchema.parse(input);
  await assertGroupRoom(data.roomId);
  await assertRoomHubManager(data.roomId, session.user.id);

  const rows = await prisma.roomCustomProcessPhase.findMany({
    where: { roomId: data.roomId },
    select: { id: true },
  });
  const valid = new Set(rows.map((r) => r.id));
  if (
    data.orderedGroupIds.length !== rows.length ||
    data.orderedGroupIds.some((id) => !valid.has(id))
  ) {
    throw new Error(
      "Urutan kelompok tidak valid. Muat ulang dialog lalu coba lagi.",
    );
  }

  await prisma.$transaction(
    data.orderedGroupIds.map((id, sortOrder) =>
      prisma.roomCustomProcessPhase.update({
        where: { id },
        data: { sortOrder },
      }),
    ),
  );

  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${data.roomId}/tasks`);
}

/**
 * Hapus kelompok. Tugas di dalamnya TIDAK ikut terhapus — relasi
 * `Task.customProcessPhase` memakai `onDelete: SetNull`, jadi tugasnya jatuh
 * kembali ke tab "Umum". Kolom Kanban tidak tersentuh karena dipakai bersama.
 */
export async function deleteRoomTaskGroup(groupId: string): Promise<number> {
  const session = await requireTasksRoomHubSession();
  const group = await prisma.roomCustomProcessPhase.findUniqueOrThrow({
    where: { id: groupId },
    select: { roomId: true },
  });
  await assertGroupRoom(group.roomId);
  await assertRoomHubManager(group.roomId, session.user.id);

  const movedToUngrouped = await prisma.task.count({
    where: { customProcessPhaseId: groupId },
  });

  await prisma.roomCustomProcessPhase.delete({ where: { id: groupId } });

  // `allowedCustomProcessPhaseIds` adalah String[] biasa (bukan FK), jadi id
  // yang sudah dihapus tidak ikut hilang sendiri. Ruangan non-brand memang
  // tidak memakai daftar ini, tapi dibersihkan agar tidak jadi sampah bila
  // ruangannya kelak ditautkan ke brand.
  const members = await prisma.roomMember.findMany({
    where: {
      roomId: group.roomId,
      allowedCustomProcessPhaseIds: { has: groupId },
    },
    select: { id: true, allowedCustomProcessPhaseIds: true },
  });
  for (const m of members) {
    await prisma.roomMember.update({
      where: { id: m.id },
      data: {
        allowedCustomProcessPhaseIds: m.allowedCustomProcessPhaseIds.filter(
          (id) => id !== groupId,
        ),
      },
    });
  }

  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${group.roomId}/tasks`);
  return movedToUngrouped;
}

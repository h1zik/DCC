"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomHubManager } from "@/lib/room-access";
import { isSimpleHubRoom } from "@/lib/room-simple-hub";
import { ensureDefaultRoomKanbanColumnsForCustomPhase } from "@/lib/room-kanban-columns";
import { ensureRoomProcessPhases } from "@/lib/room-process-phases-seed";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";

const nameSchema = z.string().trim().min(1, "Nama fase wajib diisi.").max(80);

export type RoomCustomProcessPhaseDTO = {
  id: string;
  name: string;
  sortOrder: number;
  legacyProcessKey: string | null;
};

export async function listRoomCustomProcessPhases(
  roomId: string,
): Promise<RoomCustomProcessPhaseDTO[]> {
  const rows = await ensureRoomProcessPhases(roomId);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sortOrder: r.sortOrder,
    legacyProcessKey: r.legacyProcessKey,
  }));
}

export async function createRoomCustomProcessPhase(input: {
  roomId: string;
  name: string;
}): Promise<RoomCustomProcessPhaseDTO> {
  const session = await requireTasksRoomHubSession();
  const name = nameSchema.parse(input.name);
  if (await isSimpleHubRoom(input.roomId)) {
    throw new Error("Ruangan ini tidak memakai fase proses.");
  }
  await assertRoomHubManager(input.roomId, session.user.id);

  const max = await prisma.roomCustomProcessPhase.aggregate({
    where: { roomId: input.roomId },
    _max: { sortOrder: true },
  });

  const created = await prisma.roomCustomProcessPhase.create({
    data: {
      roomId: input.roomId,
      name,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
      legacyProcessKey: null,
    },
    select: {
      id: true,
      name: true,
      sortOrder: true,
      legacyProcessKey: true,
    },
  });

  await ensureDefaultRoomKanbanColumnsForCustomPhase(input.roomId, created.id);

  const members = await prisma.roomMember.findMany({
    where: {
      roomId: input.roomId,
      role: { in: ["ROOM_MANAGER", "ROOM_CONTRIBUTOR"] },
    },
    select: { id: true, allowedCustomProcessPhaseIds: true },
  });
  for (const m of members) {
    if (m.allowedCustomProcessPhaseIds.includes(created.id)) continue;
    await prisma.roomMember.update({
      where: { id: m.id },
      data: {
        allowedCustomProcessPhaseIds: [
          ...m.allowedCustomProcessPhaseIds,
          created.id,
        ],
      },
    });
  }

  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${input.roomId}/tasks`);
  revalidatePath(`/room/${input.roomId}/members`);
  return {
    id: created.id,
    name: created.name,
    sortOrder: created.sortOrder,
    legacyProcessKey: created.legacyProcessKey,
  };
}

const reorderSchema = z.object({
  roomId: z.string().min(1),
  orderedPhaseIds: z.array(z.string().min(1)).min(1),
});

export async function reorderRoomCustomProcessPhases(
  input: z.infer<typeof reorderSchema>,
): Promise<void> {
  const session = await requireTasksRoomHubSession();
  const data = reorderSchema.parse(input);
  if (await isSimpleHubRoom(data.roomId)) {
    throw new Error("Ruangan ini tidak memakai fase proses.");
  }
  await assertRoomHubManager(data.roomId, session.user.id);

  const rows = await prisma.roomCustomProcessPhase.findMany({
    where: { roomId: data.roomId },
    select: { id: true },
  });
  const valid = new Set(rows.map((r) => r.id));
  if (
    data.orderedPhaseIds.length !== rows.length ||
    data.orderedPhaseIds.some((id) => !valid.has(id))
  ) {
    throw new Error("Urutan fase tidak valid. Muat ulang dialog lalu coba lagi.");
  }

  await prisma.$transaction(
    data.orderedPhaseIds.map((id, sortOrder) =>
      prisma.roomCustomProcessPhase.update({
        where: { id },
        data: { sortOrder },
      }),
    ),
  );

  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${data.roomId}/tasks`);
}

export async function updateRoomCustomProcessPhase(input: {
  phaseId: string;
  name: string;
}): Promise<RoomCustomProcessPhaseDTO> {
  const session = await requireTasksRoomHubSession();
  const name = nameSchema.parse(input.name);
  const phase = await prisma.roomCustomProcessPhase.findUniqueOrThrow({
    where: { id: input.phaseId },
    select: { roomId: true },
  });
  await assertRoomHubManager(phase.roomId, session.user.id);

  const updated = await prisma.roomCustomProcessPhase.update({
    where: { id: input.phaseId },
    data: { name },
    select: {
      id: true,
      name: true,
      sortOrder: true,
      legacyProcessKey: true,
    },
  });

  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${phase.roomId}/tasks`);
  return {
    id: updated.id,
    name: updated.name,
    sortOrder: updated.sortOrder,
    legacyProcessKey: updated.legacyProcessKey,
  };
}

async function countTasksInPhase(phase: {
  id: string;
  roomId: string;
  legacyProcessKey: import("@prisma/client").RoomTaskProcess | null;
}): Promise<number> {
  const byId = await prisma.task.count({
    where: {
      customProcessPhaseId: phase.id,
      project: { roomId: phase.roomId },
    },
  });

  if (!phase.legacyProcessKey) return byId;

  const legacy = await prisma.task.count({
    where: {
      customProcessPhaseId: null,
      roomProcess: phase.legacyProcessKey,
      project: { roomId: phase.roomId },
    },
  });

  return byId + legacy;
}

export async function deleteRoomCustomProcessPhase(phaseId: string): Promise<void> {
  const session = await requireTasksRoomHubSession();
  const phase = await prisma.roomCustomProcessPhase.findUniqueOrThrow({
    where: { id: phaseId },
    select: { roomId: true, legacyProcessKey: true },
  });
  await assertRoomHubManager(phase.roomId, session.user.id);

  const taskCount = await countTasksInPhase({
    id: phaseId,
    roomId: phase.roomId,
    legacyProcessKey: phase.legacyProcessKey,
  });
  if (taskCount > 0) {
    throw new Error(
      `Fase masih memiliki ${taskCount} tugas. Pindahkan atau hapus tugas tersebut terlebih dahulu.`,
    );
  }

  const members = await prisma.roomMember.findMany({
    where: { roomId: phase.roomId },
    select: { id: true, allowedCustomProcessPhaseIds: true },
  });
  for (const m of members) {
    const next = m.allowedCustomProcessPhaseIds.filter((id) => id !== phaseId);
    if (next.length !== m.allowedCustomProcessPhaseIds.length) {
      await prisma.roomMember.update({
        where: { id: m.id },
        data: { allowedCustomProcessPhaseIds: next },
      });
    }
  }

  await prisma.roomCustomProcessPhase.delete({ where: { id: phaseId } });

  revalidateTasksAndRoomHub();
  revalidatePath(`/room/${phase.roomId}/tasks`);
  revalidatePath(`/room/${phase.roomId}/members`);
}

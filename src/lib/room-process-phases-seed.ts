import { RoomTaskProcess } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ensureDefaultRoomKanbanColumnsForCustomPhase,
} from "@/lib/room-kanban-columns";
import { isSimpleHubRoom } from "@/lib/room-simple-hub";
import { ROOM_TASK_PROCESS_ORDER, roomTaskProcessLabel } from "@/lib/room-task-process";

export type RoomProcessPhaseRow = {
  id: string;
  name: string;
  sortOrder: number;
  legacyProcessKey: RoomTaskProcess | null;
};

/**
 * Seed fase bawaan sebagai baris DB (sekali, saat ruangan belum punya fase), lalu
 * tautkan tugas/kolom lama ke `customProcessPhaseId` agar edit/hapus konsisten.
 */
export async function ensureRoomProcessPhases(
  roomId: string,
): Promise<RoomProcessPhaseRow[]> {
  const existing = await prisma.roomCustomProcessPhase.findMany({
    where: { roomId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      legacyProcessKey: true,
    },
  });

  // Ruangan non-brand (HQ/Team) memakai baris ini sebagai kelompok tugas: tidak
  // ada kelompok bawaan, dan tugas tab "Umum" (`customProcessPhaseId = null`)
  // tidak boleh ditautkan ulang ke fase legacy. Kembalikan apa adanya.
  if (await isSimpleHubRoom(roomId)) return existing;

  const byLegacy = new Map(
    existing
      .filter((p) => p.legacyProcessKey != null)
      .map((p) => [p.legacyProcessKey!, p]),
  );

  let sortOrder = existing.reduce((max, p) => Math.max(max, p.sortOrder), -1);

  // Seed fase bawaan hanya untuk ruangan yang belum punya fase sama sekali.
  // Kalau sudah ada baris, fase bawaan yang hilang berarti sengaja dihapus
  // manager — jangan dibuat ulang.
  const legacyKeysToSeed = existing.length === 0 ? ROOM_TASK_PROCESS_ORDER : [];

  for (let i = 0; i < legacyKeysToSeed.length; i++) {
    const legacyKey = legacyKeysToSeed[i]!;
    if (byLegacy.has(legacyKey)) continue;

    sortOrder += 1;
    const created = await prisma.roomCustomProcessPhase.create({
      data: {
        roomId,
        name: roomTaskProcessLabel(legacyKey),
        sortOrder,
        legacyProcessKey: legacyKey,
      },
      select: {
        id: true,
        name: true,
        sortOrder: true,
        legacyProcessKey: true,
      },
    });
    byLegacy.set(legacyKey, created);
  }

  // Urutan tab Tasks mengikuti sortOrder; jangan pakai urutan enum tetap.
  const phases = await prisma.roomCustomProcessPhase.findMany({
    where: { roomId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      legacyProcessKey: true,
    },
  });

  for (const phase of phases) {
    if (phase.legacyProcessKey) {
      await prisma.task.updateMany({
        where: {
          customProcessPhaseId: null,
          roomProcess: phase.legacyProcessKey,
          project: { roomId },
        },
        data: { customProcessPhaseId: phase.id },
      });

      await migrateLegacyKanbanColumns(roomId, phase.id, phase.legacyProcessKey);
    }

    const columnCount = await prisma.roomKanbanColumn.count({
      where: { roomId, customProcessPhaseId: phase.id },
    });
    if (columnCount === 0) {
      await ensureDefaultRoomKanbanColumnsForCustomPhase(roomId, phase.id);
    }
  }

  await syncMemberPhaseAccessFromLegacy(roomId, phases);

  return phases;
}

/**
 * Kolom Kanban lama memakai `roomProcess` enum; kolom baru memakai `customProcessPhaseId`.
 * Jika keduanya ada, hapus duplikat lama agar tidak melanggar unique constraint.
 */
async function migrateLegacyKanbanColumns(
  roomId: string,
  phaseId: string,
  legacyProcessKey: RoomTaskProcess,
): Promise<void> {
  const legacyCols = await prisma.roomKanbanColumn.findMany({
    where: {
      roomId,
      roomProcess: legacyProcessKey,
      customProcessPhaseId: null,
    },
    select: { id: true },
  });

  const modernCount = await prisma.roomKanbanColumn.count({
    where: { roomId, customProcessPhaseId: phaseId },
  });

  if (legacyCols.length === 0) return;

  if (modernCount === 0) {
    await prisma.roomKanbanColumn.updateMany({
      where: { id: { in: legacyCols.map((c) => c.id) } },
      data: {
        customProcessPhaseId: phaseId,
        roomProcess: null,
      },
    });
    return;
  }

  await prisma.roomKanbanColumn.deleteMany({
    where: { id: { in: legacyCols.map((c) => c.id) } },
  });
}

/** Salin akses enum lama ke id fase (sekali per anggota). */
async function syncMemberPhaseAccessFromLegacy(
  roomId: string,
  phases: RoomProcessPhaseRow[],
) {
  const legacyToId = new Map(
    phases
      .filter((p) => p.legacyProcessKey != null)
      .map((p) => [p.legacyProcessKey!, p.id]),
  );

  const members = await prisma.roomMember.findMany({
    where: {
      roomId,
      role: { in: ["ROOM_MANAGER", "ROOM_CONTRIBUTOR"] },
    },
    select: {
      id: true,
      allowedRoomProcesses: true,
      allowedCustomProcessPhaseIds: true,
    },
  });

  for (const m of members) {
    const fromLegacy = m.allowedRoomProcesses
      .map((key) => legacyToId.get(key))
      .filter((id): id is string => Boolean(id));
    const merged = [...new Set([...m.allowedCustomProcessPhaseIds, ...fromLegacy])];
    if (
      merged.length === m.allowedCustomProcessPhaseIds.length &&
      merged.every((id) => m.allowedCustomProcessPhaseIds.includes(id))
    ) {
      continue;
    }
    await prisma.roomMember.update({
      where: { id: m.id },
      data: { allowedCustomProcessPhaseIds: merged },
    });
  }
}

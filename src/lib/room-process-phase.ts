import { RoomTaskProcess } from "@prisma/client";
import type { RoomProcessPhaseRow } from "@/lib/room-process-phases-seed";
import {
  ALL_ROOM_TASK_PROCESSES,
  ROOM_TASK_PROCESS_ORDER,
  roomTaskProcessLabel,
} from "@/lib/room-task-process";

/** Referensi fase proses ruangan (selalu id baris di DB). */
export type RoomProcessPhaseRef = {
  id: string;
  name: string;
  legacyProcessKey?: RoomTaskProcess | null;
};

export type RoomCustomProcessPhaseRow = RoomProcessPhaseRow;

const LEGACY_SET = new Set<string>(Object.values(RoomTaskProcess));

export function isLegacyRoomTaskProcess(value: string): value is RoomTaskProcess {
  return LEGACY_SET.has(value);
}

export function phaseRef(
  row: Pick<RoomProcessPhaseRow, "id" | "name" | "legacyProcessKey">,
): RoomProcessPhaseRef {
  return {
    id: row.id,
    name: row.name,
    legacyProcessKey: row.legacyProcessKey,
  };
}

/** @deprecated Gunakan `phaseRef`. */
export function customPhaseRef(
  row: Pick<RoomProcessPhaseRow, "id" | "name" | "legacyProcessKey">,
): RoomProcessPhaseRef {
  return phaseRef(row);
}

/** @deprecated Gunakan `phaseRef` setelah seed DB. */
export function legacyPhaseRef(process: RoomTaskProcess): RoomProcessPhaseRef {
  return { id: process, name: roomTaskProcessLabel(process), legacyProcessKey: process };
}

export function roomProcessPhaseKey(ref: RoomProcessPhaseRef): string {
  return ref.id;
}

export function roomProcessPhaseLabel(ref: RoomProcessPhaseRef): string {
  return ref.name;
}

export function buildRoomProcessPhaseList(
  phases: RoomProcessPhaseRow[],
): RoomProcessPhaseRef[] {
  return [...phases]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((p) => phaseRef(p));
}

/**
 * Parse query `process`: id fase, atau nilai enum bawaan (bookmark lama).
 */
export function parseRoomProcessPhaseParam(
  raw: string | string[] | undefined | null,
  phases: RoomProcessPhaseRow[],
): RoomProcessPhaseRef | null {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!v) return null;

  const byId = phases.find((p) => p.id === v);
  if (byId) return phaseRef(byId);

  if (isLegacyRoomTaskProcess(v)) {
    const byLegacy = phases.find((p) => p.legacyProcessKey === v);
    if (byLegacy) return phaseRef(byLegacy);
    return legacyPhaseRef(v);
  }

  return null;
}

export function defaultRoomProcessPhaseRef(
  phases: RoomProcessPhaseRow[],
): RoomProcessPhaseRef {
  const sorted = [...phases].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  const first = sorted[0];
  if (first) return phaseRef(first);
  return legacyPhaseRef(ROOM_TASK_PROCESS_ORDER[0]!);
}

export function taskBelongsToPhase(
  task: { roomProcess: RoomTaskProcess; customProcessPhaseId: string | null },
  phase: RoomProcessPhaseRef,
): boolean {
  if (task.customProcessPhaseId) {
    return task.customProcessPhaseId === phase.id;
  }
  if (phase.legacyProcessKey) {
    return task.roomProcess === phase.legacyProcessKey;
  }
  return false;
}

export function taskPhaseWhere(phase: RoomProcessPhaseRef) {
  return { customProcessPhaseId: phase.id };
}

export function taskToPhaseRef(task: {
  roomProcess: RoomTaskProcess;
  customProcessPhaseId: string | null;
  customProcessPhase?: {
    id: string;
    name: string;
    legacyProcessKey?: RoomTaskProcess | null;
  } | null;
}): RoomProcessPhaseRef {
  if (task.customProcessPhase) {
    return phaseRef({
      id: task.customProcessPhase.id,
      name: task.customProcessPhase.name,
      legacyProcessKey: task.customProcessPhase.legacyProcessKey ?? null,
    });
  }
  if (task.customProcessPhaseId) {
    return {
      id: task.customProcessPhaseId,
      name: "Fase proses",
      legacyProcessKey: null,
    };
  }
  return legacyPhaseRef(task.roomProcess);
}

export { ALL_ROOM_TASK_PROCESSES, ROOM_TASK_PROCESS_ORDER, roomTaskProcessLabel };

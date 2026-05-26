import {
  isLegacyRoomTaskProcess,
  phaseRef,
  type RoomProcessPhaseRef,
} from "@/lib/room-process-phase";
import { ensureRoomProcessPhases } from "@/lib/room-process-phases-seed";

/** `process` query / form: id fase atau nilai enum bawaan (bookmark lama). */
export async function resolveRoomProcessPhaseKey(
  roomId: string,
  processKey: string,
): Promise<RoomProcessPhaseRef> {
  const phases = await ensureRoomProcessPhases(roomId);

  const byId = phases.find((p) => p.id === processKey);
  if (byId) return phaseRef(byId);

  if (isLegacyRoomTaskProcess(processKey)) {
    const byLegacy = phases.find((p) => p.legacyProcessKey === processKey);
    if (byLegacy) return phaseRef(byLegacy);
  }

  throw new Error("Fase proses tidak valid untuk ruangan ini.");
}

export function kanbanColumnWhere(
  roomId: string,
  phase: RoomProcessPhaseRef,
): {
  roomId: string;
  customProcessPhaseId: string;
} {
  return { roomId, customProcessPhaseId: phase.id };
}

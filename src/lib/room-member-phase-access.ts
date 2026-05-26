import type { RoomTaskProcess } from "@prisma/client";
import type { RoomProcessPhaseRow } from "@/lib/room-process-phases-seed";

export type RoomPhaseOption = Pick<
  RoomProcessPhaseRow,
  "id" | "name" | "sortOrder" | "legacyProcessKey"
>;

export type MemberPhaseAccessFields = {
  allowedRoomProcesses: RoomTaskProcess[];
  allowedCustomProcessPhaseIds: string[];
};

/** Id fase yang boleh diakses anggota (selaras dengan daftar fase ruangan saat ini). */
export function memberAllowedPhaseIds(
  member: MemberPhaseAccessFields,
  roomPhases: RoomPhaseOption[],
): string[] {
  const validIds = new Set(roomPhases.map((p) => p.id));

  const fromCustom = member.allowedCustomProcessPhaseIds.filter((id) =>
    validIds.has(id),
  );
  if (fromCustom.length > 0) return fromCustom;

  return roomPhases
    .filter(
      (p) =>
        p.legacyProcessKey != null &&
        member.allowedRoomProcesses.includes(p.legacyProcessKey),
    )
    .map((p) => p.id);
}

export function allRoomPhaseIds(roomPhases: RoomPhaseOption[]): string[] {
  return roomPhases.map((p) => p.id);
}

export function legacyProcessesFromPhaseIds(
  roomPhases: RoomPhaseOption[],
  phaseIds: string[],
): RoomTaskProcess[] {
  const idSet = new Set(phaseIds);
  const legacy: RoomTaskProcess[] = [];
  for (const p of roomPhases) {
    if (p.legacyProcessKey && idSet.has(p.id)) {
      legacy.push(p.legacyProcessKey);
    }
  }
  return legacy;
}

export function phaseLabelsForMember(
  member: MemberPhaseAccessFields,
  roomPhases: RoomPhaseOption[],
): string[] {
  const ids = memberAllowedPhaseIds(member, roomPhases);
  const byId = new Map(roomPhases.map((p) => [p.id, p.name]));
  return ids.map((id) => byId.get(id) ?? "Fase");
}

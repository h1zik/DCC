import { RoomWorkspaceSection } from "@prisma/client";

/** Urutan tampilan di menu Tugas & Kanban. */
export const ROOM_WORKSPACE_SECTION_ORDER: RoomWorkspaceSection[] = [
  RoomWorkspaceSection.HQ,
  RoomWorkspaceSection.TEAM,
  RoomWorkspaceSection.ROOMS,
];

export function roomWorkspaceSectionTitle(s: RoomWorkspaceSection): string {
  switch (s) {
    case RoomWorkspaceSection.HQ:
      return "HQ";
    case RoomWorkspaceSection.TEAM:
      return "Team";
    case RoomWorkspaceSection.ROOMS:
      return "Ruangan";
    default:
      return s;
  }
}

export function roomWorkspaceSectionBlurb(s: RoomWorkspaceSection): string {
  switch (s) {
    case RoomWorkspaceSection.HQ:
      return "Ruang koordinasi pusat — ditampilkan terlebih dahulu di menu Tugas.";
    case RoomWorkspaceSection.TEAM:
      return "Ruang kerja tim inti studio atau PM.";
    case RoomWorkspaceSection.ROOMS:
      return "Ruang kerja brand atau proyek lainnya.";
    default:
      return "";
  }
}

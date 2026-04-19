import { PipelineStage, RoomWorkspaceSection } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Ruangan HQ/Team tanpa brand: hub mini (Tasks, Chat, Dokumen) tanpa fase proses produk. */
export function isSimpleTeamOrHqRoom(room: {
  brandId: string | null;
  workspaceSection: RoomWorkspaceSection;
}): boolean {
  return (
    !room.brandId &&
    (room.workspaceSection === RoomWorkspaceSection.HQ ||
      room.workspaceSection === RoomWorkspaceSection.TEAM)
  );
}

export async function isSimpleHubRoom(roomId: string): Promise<boolean> {
  const r = await prisma.room.findUnique({
    where: { id: roomId },
    select: { brandId: true, workspaceSection: true },
  });
  if (!r) return false;
  return isSimpleTeamOrHqRoom(r);
}

/** Label notifikasi / UI untuk tugas di proyek tanpa brand. */
export function taskProjectContextLabel(project: {
  name: string;
  brand: { name: string } | null;
  room?: { name: string };
}): string {
  if (project.brand) return project.brand.name;
  if (project.room) return `Ruang: ${project.room.name}`;
  return project.name;
}

/**
 * Pastikan ada satu proyek papan (tanpa brand) untuk ruangan HQ/Team tanpa brand.
 * Dipanggil setelah buat/ubah ruangan.
 */
export async function ensureSimpleRoomBoardProject(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, name: true, brandId: true, workspaceSection: true },
  });
  if (!room || !isSimpleTeamOrHqRoom(room)) return;

  const existing = await prisma.project.findFirst({
    where: { roomId, brandId: null },
  });
  if (existing) return;

  await prisma.project.create({
    data: {
      roomId,
      brandId: null,
      name: `Papan tugas — ${room.name}`,
      currentStage: PipelineStage.MARKET_RESEARCH,
      stageEnteredAt: new Date(),
    },
  });
}

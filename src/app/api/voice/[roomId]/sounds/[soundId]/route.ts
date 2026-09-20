import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRoomHubManagerRole } from "@/lib/room-member-process-access";
import { deleteRoomSoundFile } from "@/lib/room-sound-storage";
import { authorizeVoiceRoomRequest } from "@/lib/voice-route-auth";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ roomId: string; soundId: string }> },
) {
  const { roomId, soundId } = await context.params;
  const access = await authorizeVoiceRoomRequest(roomId);
  if (!access.ok) return access.response;

  const sound = await prisma.roomSound.findFirst({
    where: { id: soundId, roomId },
    select: { id: true, publicPath: true, createdById: true },
  });
  if (!sound) {
    return NextResponse.json(
      { error: "Suara tidak ditemukan." },
      { status: 404 },
    );
  }
  // Pengunggah boleh menghapus miliknya; manajer ruangan boleh menghapus semua.
  if (
    sound.createdById !== access.userId &&
    !isRoomHubManagerRole(access.member.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.roomSound.delete({ where: { id: sound.id } });
  await deleteRoomSoundFile(sound.publicPath);
  return NextResponse.json({ ok: true });
}

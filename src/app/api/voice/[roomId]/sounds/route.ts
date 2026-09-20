import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRoomHubManagerRole } from "@/lib/room-member-process-access";
import {
  saveRoomSoundFile,
  deleteRoomSoundFile,
} from "@/lib/room-sound-storage";
import { authorizeVoiceRoomRequest } from "@/lib/voice-route-auth";
import {
  ROOM_SOUND_MAX_DURATION_MS,
  ROOM_SOUND_MAX_PER_ROOM,
  normalizeRoomSoundEmoji,
  normalizeRoomSoundName,
  type RoomSoundView,
} from "@/lib/voice-sounds";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

function toView(
  sound: {
    id: string;
    name: string;
    emoji: string | null;
    publicPath: string;
    durationMs: number;
    createdById: string;
  },
  viewer: { userId: string; isManager: boolean },
): RoomSoundView {
  return {
    id: sound.id,
    name: sound.name,
    emoji: sound.emoji,
    url: sound.publicPath,
    durationMs: sound.durationMs,
    canDelete: viewer.isManager || sound.createdById === viewer.userId,
  };
}

const SOUND_SELECT = {
  id: true,
  name: true,
  emoji: true,
  publicPath: true,
  durationMs: true,
  createdById: true,
} as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  const access = await authorizeVoiceRoomRequest(roomId);
  if (!access.ok) return access.response;

  const sounds = await prisma.roomSound.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
    select: SOUND_SELECT,
  });
  const viewer = {
    userId: access.userId,
    isManager: isRoomHubManagerRole(access.member.role),
  };
  return NextResponse.json(
    { sounds: sounds.map((sound) => toView(sound, viewer)) },
    { headers: NO_STORE },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  const access = await authorizeVoiceRoomRequest(roomId);
  if (!access.ok) return access.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const file = form.get("file");
  const name = normalizeRoomSoundName(String(form.get("name") ?? ""));
  const emoji = normalizeRoomSoundEmoji(String(form.get("emoji") ?? ""));
  const durationMs = Math.round(Number(form.get("durationMs")));

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Berkas audio wajib diisi." },
      { status: 400 },
    );
  }
  if (!name) {
    return NextResponse.json(
      { error: "Nama suara wajib diisi." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return NextResponse.json(
      { error: "Durasi suara tidak valid." },
      { status: 400 },
    );
  }
  if (durationMs > ROOM_SOUND_MAX_DURATION_MS) {
    return NextResponse.json(
      {
        error: `Durasi suara maksimal ${ROOM_SOUND_MAX_DURATION_MS / 1000} detik.`,
      },
      { status: 400 },
    );
  }

  const count = await prisma.roomSound.count({ where: { roomId } });
  if (count >= ROOM_SOUND_MAX_PER_ROOM) {
    return NextResponse.json(
      {
        error: `Soundboard ruangan ini sudah penuh (${ROOM_SOUND_MAX_PER_ROOM} suara). Hapus salah satu dulu.`,
      },
      { status: 409 },
    );
  }

  let saved: { publicPath: string; sizeBytes: number };
  try {
    saved = await saveRoomSoundFile({ roomId, file });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal menyimpan suara." },
      { status: 400 },
    );
  }

  try {
    const sound = await prisma.roomSound.create({
      data: {
        roomId,
        name,
        emoji,
        publicPath: saved.publicPath,
        sizeBytes: saved.sizeBytes,
        durationMs,
        createdById: access.userId,
      },
      select: SOUND_SELECT,
    });
    return NextResponse.json(
      { sound: toView(sound, { userId: access.userId, isManager: false }) },
      { headers: NO_STORE },
    );
  } catch {
    await deleteRoomSoundFile(saved.publicPath);
    return NextResponse.json(
      { error: "Gagal menyimpan suara." },
      { status: 500 },
    );
  }
}

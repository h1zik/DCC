import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  absolutePathFromStoredPublicPath,
  getUploadPublicDir,
} from "@/lib/upload-storage";
import {
  ROOM_SOUND_MAX_BYTES,
  ROOM_SOUND_MAX_BYTES_LABEL,
  roomSoundExtension,
} from "@/lib/voice-sounds";

/** Simpan berkas audio soundboard ke /uploads/room-sounds/{roomId}/. */
export async function saveRoomSoundFile(params: {
  roomId: string;
  file: File;
}): Promise<{ publicPath: string; sizeBytes: number }> {
  if (params.file.size === 0) throw new Error("Berkas audio kosong.");
  if (params.file.size > ROOM_SOUND_MAX_BYTES) {
    throw new Error(`Ukuran suara maksimal ${ROOM_SOUND_MAX_BYTES_LABEL}.`);
  }
  const ext = roomSoundExtension(params.file.type, params.file.name);
  if (!ext) throw new Error("Format suara harus MP3 atau WAV.");

  // Nama simpan = UUID + ekstensi dari mime (bukan nama asli) — path immutable
  // dan content-type yang dilayani /uploads selalu audio.
  const stored = `${randomUUID()}${ext}`;
  const absDir = path.join(getUploadPublicDir(), "room-sounds", params.roomId);
  await mkdir(absDir, { recursive: true });
  await writeFile(
    path.join(absDir, stored),
    Buffer.from(await params.file.arrayBuffer()),
  );
  return {
    publicPath: `/uploads/room-sounds/${params.roomId}/${stored}`,
    sizeBytes: params.file.size,
  };
}

/** Hapus berkas suara; berkas yang sudah hilang diabaikan. */
export async function deleteRoomSoundFile(publicPath: string): Promise<void> {
  const abs = absolutePathFromStoredPublicPath(publicPath);
  if (!abs) return;
  await unlink(abs).catch(() => undefined);
}

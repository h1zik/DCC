import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getUploadPublicDir } from "@/lib/upload-storage";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
import {
  isDirectChatAllowedMime,
  sanitizeDirectChatFileName,
} from "@/lib/direct-chat-attachments-shared";

export {
  DIRECT_CHAT_MAX_FILES_PER_MESSAGE,
  isDirectChatAllowedMime,
  isDirectChatImageMime,
  sanitizeDirectChatFileName,
} from "@/lib/direct-chat-attachments-shared";

export async function saveRoomChatAttachmentFile(params: {
  roomId: string;
  messageId: string;
  file: File;
}): Promise<{
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  publicPath: string;
}> {
  if (params.file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
  }
  const mime = params.file.type || "application/octet-stream";
  if (!isDirectChatAllowedMime(mime, params.file.name)) {
    throw new Error(
      "Tipe file tidak diizinkan (gambar, PDF, dokumen Office, zip, video/audio, teks).",
    );
  }
  const buf = Buffer.from(await params.file.arrayBuffer());
  const stored = `${randomUUID()}-${sanitizeDirectChatFileName(params.file.name)}`;
  const absDir = path.join(
    getUploadPublicDir(),
    "room-chat",
    params.roomId,
    params.messageId,
  );
  await mkdir(absDir, { recursive: true });
  const absFile = path.join(absDir, stored);
  await writeFile(absFile, buf);
  const publicPath = `/uploads/room-chat/${params.roomId}/${params.messageId}/${stored}`;
  return {
    fileName: params.file.name,
    mimeType: mime,
    sizeBytes: params.file.size,
    publicPath,
  };
}

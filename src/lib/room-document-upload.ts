import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getUploadPublicDir } from "@/lib/upload-storage";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

const ALLOWED_PREFIXES = [
  "image/",
  "application/pdf",
  "text/",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-",
  "application/zip",
  "application/x-zip",
  "application/gzip",
  "application/x-tar",
  "application/json",
  "application/xml",
  "video/",
  "audio/",
];

export function isAllowedRoomDocumentMime(mime: string): boolean {
  const m = (mime || "application/octet-stream").toLowerCase();
  if (m === "application/octet-stream") return true;
  if (m.startsWith("text/")) return true;
  return ALLOWED_PREFIXES.some((p) => m.startsWith(p));
}

export function sanitizeRoomDocumentBaseName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export type SaveRoomDocumentParams = {
  roomId: string;
  uploadedById: string;
  folderId: string | null;
  title: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
  tags?: string[];
};

/**
 * Validasi + tulis disk + buat baris `RoomDocument`. Dipakai server action & API route.
 */
export async function saveRoomDocumentToStorageAndDb(
  params: SaveRoomDocumentParams,
): Promise<{ id: string; publicPath: string }> {
  if (params.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
  }
  const mime = params.mimeType || "application/octet-stream";
  if (!isAllowedRoomDocumentMime(mime)) {
    throw new Error("Tipe file tidak diizinkan.");
  }

  const base = sanitizeRoomDocumentBaseName(params.fileName);
  const stored = `${randomUUID()}-${base}`;
  const absDir = path.join(getUploadPublicDir(), "rooms", params.roomId);
  await mkdir(absDir, { recursive: true });
  const absFile = path.join(absDir, stored);
  await writeFile(absFile, params.buffer);

  const publicPath = `/uploads/rooms/${params.roomId}/${stored}`;
  const row = await prisma.roomDocument.create({
    data: {
      roomId: params.roomId,
      folderId: params.folderId,
      uploadedById: params.uploadedById,
      title: params.title,
      fileName: params.fileName,
      mimeType: mime,
      size: params.size,
      publicPath,
      tags: params.tags?.length ? params.tags : [],
    },
    select: { id: true, publicPath: true },
  });
  return row;
}

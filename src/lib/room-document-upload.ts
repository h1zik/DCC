import "server-only";

import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { prisma } from "@/lib/prisma";
import { maybeGenerateThumbnail } from "@/lib/document-thumbnail";
import { getUploadPublicDir } from "@/lib/upload-storage";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
import { readRoomDocumentText } from "@/lib/room-document-text";
import { logRoomDocumentActivity } from "@/lib/room-document-activity";
import { isCreativeFile } from "@/lib/creative-file-formats";

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

export function isAllowedRoomDocumentMime(
  mime: string,
  fileName?: string,
): boolean {
  const m = (mime || "application/octet-stream").toLowerCase();
  if (m === "application/octet-stream") return true;
  if (m.startsWith("text/")) return true;
  if (isCreativeFile(m, fileName)) return true;
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
  /**
   * Web `ReadableStream` dari `File.stream()`. Di-pipe langsung ke disk agar
   * tidak perlu menyalin seluruh berkas ke `Buffer` (penting untuk unggahan
   * besar — batas 500 MB).
   */
  body: ReadableStream<Uint8Array>;
  tags?: string[];
};

/**
 * Validasi + tulis disk (streaming) + thumbnail (image/video) + buat baris
 * `RoomDocument`. Dipakai server action & API route. Logika ekstraksi
 * thumbnail dipisah ke `@/lib/document-thumbnail` sehingga script backfill
 * Node biasa juga bisa memakainya tanpa rantai dependency `server-only`.
 */
export async function saveRoomDocumentToStorageAndDb(
  params: SaveRoomDocumentParams,
): Promise<{ id: string; publicPath: string; thumbPath: string | null }> {
  if (params.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
  }
  const mime = params.mimeType || "application/octet-stream";
  if (!isAllowedRoomDocumentMime(mime, params.fileName)) {
    throw new Error("Tipe file tidak diizinkan.");
  }

  const base = sanitizeRoomDocumentBaseName(params.fileName);
  const stored = `${randomUUID()}-${base}`;
  const absDir = path.join(getUploadPublicDir(), "rooms", params.roomId);
  await mkdir(absDir, { recursive: true });
  const absFile = path.join(absDir, stored);
  const publicPathPrefix = `/uploads/rooms/${params.roomId}`;

  // Stream langsung ke disk — tidak ada salinan Buffer di heap Node.
  let bytesWritten = 0;
  try {
    const sourceWithCount = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytesWritten += chunk.byteLength;
        if (bytesWritten > MAX_UPLOAD_BYTES) {
          controller.error(
            new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`),
          );
          return;
        }
        controller.enqueue(chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(params.body.pipeThrough(sourceWithCount) as never),
      createWriteStream(absFile),
    );
  } catch (err) {
    await unlink(absFile).catch(() => undefined);
    throw err;
  }

  // Thumbnail — best-effort, tidak menggagalkan upload bila error.
  // `maybeGenerateThumbnail` punya logging eksplisit untuk kegagalan.
  const thumbPublicPath = await maybeGenerateThumbnail({
    absSourceFile: absFile,
    absDir,
    storedBaseName: stored,
    publicPathPrefix,
    mimeType: mime,
    sizeBytes: bytesWritten || params.size,
  });

  const publicPath = `${publicPathPrefix}/${stored}`;
  try {
    const row = await prisma.$transaction(async (tx) => {
      const document = await tx.roomDocument.create({
        data: {
          roomId: params.roomId,
          folderId: params.folderId,
          uploadedById: params.uploadedById,
          title: params.title,
          fileName: params.fileName,
          mimeType: mime,
          size: bytesWritten || params.size,
          publicPath,
          thumbPath: thumbPublicPath,
          tags: params.tags?.length ? params.tags : [],
        },
        select: { id: true, publicPath: true, thumbPath: true },
      });
      await tx.roomDocumentVersion.create({
        data: {
          documentId: document.id,
          version: 1,
          fileName: params.fileName,
          mimeType: mime,
          size: bytesWritten || params.size,
          publicPath,
          thumbPath: thumbPublicPath,
          uploadedById: params.uploadedById,
          note: "Versi awal",
        },
      });
      await logRoomDocumentActivity(tx, {
        roomId: params.roomId,
        actorId: params.uploadedById,
        action: "UPLOADED",
        targetName: params.title || params.fileName,
        documentId: document.id,
      });
      return document;
    });

    const extracted = await readRoomDocumentText({
      publicPath,
      mimeType: mime,
      fileName: params.fileName,
    });
    if (extracted.text) {
      await prisma.roomDocument.update({
        where: { id: row.id },
        data: { searchText: extracted.text },
      }).catch(() => undefined);
    }
    return row;
  } catch (err) {
    // DB gagal setelah file tertulis — bersihkan file + thumbnail.
    await unlink(absFile).catch(() => undefined);
    if (thumbPublicPath) {
      const thumbAbs = path.join(absDir, path.basename(thumbPublicPath));
      await unlink(thumbAbs).catch(() => undefined);
    }
    throw err;
  }
}

export type SaveRoomDocumentVersionParams = {
  documentId: string;
  roomId: string;
  uploadedById: string;
  note?: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  body: ReadableStream<Uint8Array>;
};

/** Simpan binary baru lalu jadikan versi aktif dokumen yang sama. */
export async function saveRoomDocumentVersionToStorageAndDb(
  params: SaveRoomDocumentVersionParams,
) {
  if (params.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
  }
  const mime = params.mimeType || "application/octet-stream";
  if (!isAllowedRoomDocumentMime(mime, params.fileName))
    throw new Error("Tipe file tidak diizinkan.");
  const stored = `${randomUUID()}-${sanitizeRoomDocumentBaseName(params.fileName)}`;
  const absDir = path.join(getUploadPublicDir(), "rooms", params.roomId);
  await mkdir(absDir, { recursive: true });
  const absFile = path.join(absDir, stored);
  const publicPathPrefix = `/uploads/rooms/${params.roomId}`;
  let bytesWritten = 0;
  try {
    const sourceWithCount = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytesWritten += chunk.byteLength;
        if (bytesWritten > MAX_UPLOAD_BYTES) {
          controller.error(new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`));
          return;
        }
        controller.enqueue(chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(params.body.pipeThrough(sourceWithCount) as never),
      createWriteStream(absFile),
    );
  } catch (error) {
    await unlink(absFile).catch(() => undefined);
    throw error;
  }
  const thumbPath = await maybeGenerateThumbnail({
    absSourceFile: absFile,
    absDir,
    storedBaseName: stored,
    publicPathPrefix,
    mimeType: mime,
    sizeBytes: bytesWritten || params.size,
  });
  const publicPath = `${publicPathPrefix}/${stored}`;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const document = await tx.roomDocument.findFirstOrThrow({
        where: {
          id: params.documentId,
          roomId: params.roomId,
          trashedAt: null,
          OR: [{ folderId: null }, { folder: { trashedAt: null } }],
        },
        select: { currentVersion: true, title: true, fileName: true },
      });
      const version = document.currentVersion + 1;
      await tx.roomDocumentVersion.create({
        data: {
          documentId: params.documentId,
          version,
          fileName: params.fileName,
          mimeType: mime,
          size: bytesWritten || params.size,
          publicPath,
          thumbPath,
          uploadedById: params.uploadedById,
          note: params.note?.trim().slice(0, 240) || null,
        },
      });
      await tx.roomDocument.update({
        where: { id: params.documentId },
        data: {
          fileName: params.fileName,
          mimeType: mime,
          size: bytesWritten || params.size,
          publicPath,
          thumbPath,
          currentVersion: version,
          searchText: null,
        },
      });
      await logRoomDocumentActivity(tx, {
        roomId: params.roomId,
        actorId: params.uploadedById,
        action: "VERSION_ADDED",
        targetName: document.title || document.fileName,
        documentId: params.documentId,
        detail: { version, note: params.note || null },
      });
      return { version, publicPath, thumbPath };
    });
    const extracted = await readRoomDocumentText({
      publicPath,
      mimeType: mime,
      fileName: params.fileName,
    });
    if (extracted.text) {
      await prisma.roomDocument.update({
        where: { id: params.documentId },
        data: { searchText: extracted.text },
      }).catch(() => undefined);
    }
    return result;
  } catch (error) {
    await unlink(absFile).catch(() => undefined);
    if (thumbPath) {
      const absoluteThumb = path.join(absDir, path.basename(thumbPath));
      await unlink(absoluteThumb).catch(() => undefined);
    }
    throw error;
  }
}

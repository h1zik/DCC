"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  absolutePathFromStoredPublicPath,
  getUploadPublicDir,
} from "@/lib/upload-storage";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { assertRoomMember, isRoomHubManagerRole } from "@/lib/room-access";

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

function isAllowedMime(mime: string): boolean {
  const m = (mime || "application/octet-stream").toLowerCase();
  if (m === "application/octet-stream") return true;
  if (m.startsWith("text/")) return true;
  return ALLOWED_PREFIXES.some((p) => m.startsWith(p));
}

function sanitizeBaseName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

const folderNameSchema = z.string().trim().min(1).max(80);

export async function createRoomDocumentFolder(input: {
  roomId: string;
  name: string;
}): Promise<{ id: string }> {
  const session = await requireTasksRoomHubSession();
  const name = folderNameSchema.parse(input.name);
  await assertRoomMember(input.roomId, session.user.id);
  const dup = await prisma.roomDocumentFolder.findFirst({
    where: {
      roomId: input.roomId,
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (dup) {
    throw new Error("Sudah ada folder dengan nama yang sama.");
  }
  const max = await prisma.roomDocumentFolder.aggregate({
    where: { roomId: input.roomId },
    _max: { sortOrder: true },
  });
  const row = await prisma.roomDocumentFolder.create({
    data: {
      roomId: input.roomId,
      name,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });
  revalidateTasksAndRoomHub();
  return { id: row.id };
}

export async function renameRoomDocumentFolder(input: {
  folderId: string;
  name: string;
}) {
  const session = await requireTasksRoomHubSession();
  const name = folderNameSchema.parse(input.name);
  const folder = await prisma.roomDocumentFolder.findUniqueOrThrow({
    where: { id: input.folderId },
    select: { roomId: true },
  });
  const m = await assertRoomMember(folder.roomId, session.user.id);
  if (!isRoomHubManagerRole(m.role)) {
    throw new Error("Hanya manager ruangan yang dapat mengganti nama folder.");
  }
  const dup = await prisma.roomDocumentFolder.findFirst({
    where: {
      roomId: folder.roomId,
      name: { equals: name, mode: "insensitive" },
      NOT: { id: input.folderId },
    },
  });
  if (dup) {
    throw new Error("Sudah ada folder dengan nama yang sama.");
  }
  await prisma.roomDocumentFolder.update({
    where: { id: input.folderId },
    data: { name },
  });
  revalidateTasksAndRoomHub();
}

export async function deleteRoomDocumentFolder(folderId: string) {
  const session = await requireTasksRoomHubSession();
  const folder = await prisma.roomDocumentFolder.findUniqueOrThrow({
    where: { id: folderId },
    select: { roomId: true },
  });
  const m = await assertRoomMember(folder.roomId, session.user.id);
  if (!isRoomHubManagerRole(m.role)) {
    throw new Error("Hanya manager ruangan yang dapat menghapus folder.");
  }
  await prisma.roomDocumentFolder.delete({ where: { id: folderId } });
  revalidateTasksAndRoomHub();
}

const moveDocSchema = z.object({
  documentId: z.string().min(1),
  folderId: z.union([z.string().min(1), z.null()]),
});

export async function moveRoomDocumentToFolder(
  input: z.infer<typeof moveDocSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = moveDocSchema.parse(input);
  const doc = await prisma.roomDocument.findUniqueOrThrow({
    where: { id: data.documentId },
    select: {
      roomId: true,
      uploadedById: true,
      folderId: true,
    },
  });
  const m = await assertRoomMember(doc.roomId, session.user.id);
  const canModerate = isRoomHubManagerRole(m.role);
  if (doc.uploadedById !== session.user.id && !canModerate) {
    throw new Error("Anda tidak dapat memindahkan dokumen ini.");
  }
  if (data.folderId != null) {
    const f = await prisma.roomDocumentFolder.findFirst({
      where: { id: data.folderId, roomId: doc.roomId },
    });
    if (!f) throw new Error("Folder tidak valid.");
  }
  if (data.folderId === doc.folderId) return;
  await prisma.roomDocument.update({
    where: { id: data.documentId },
    data: { folderId: data.folderId },
  });
  revalidateTasksAndRoomHub();
}

export async function uploadRoomDocument(roomId: string, formData: FormData) {
  const session = await requireTasksRoomHubSession();
  const titleRaw = formData.get("title");
  const title =
    typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim() : null;
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("Pilih file terlebih dahulu.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
  }
  const mime = file.type || "application/octet-stream";
  if (!isAllowedMime(mime)) {
    throw new Error("Tipe file tidak diizinkan.");
  }

  await assertRoomMember(roomId, session.user.id);
  await prisma.room.findUniqueOrThrow({ where: { id: roomId } });

  const folderIdRaw = formData.get("folderId");
  let folderId: string | null = null;
  if (typeof folderIdRaw === "string" && folderIdRaw.trim()) {
    const fid = folderIdRaw.trim();
    const f = await prisma.roomDocumentFolder.findFirst({
      where: { id: fid, roomId },
    });
    if (!f) {
      throw new Error("Folder tidak ditemukan di ruangan ini.");
    }
    folderId = fid;
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const base = sanitizeBaseName(file.name);
  const stored = `${randomUUID()}-${base}`;
  const absDir = path.join(getUploadPublicDir(), "rooms", roomId);
  await mkdir(absDir, { recursive: true });
  const absFile = path.join(absDir, stored);
  await writeFile(absFile, buf);

  const publicPath = `/uploads/rooms/${roomId}/${stored}`;
  await prisma.roomDocument.create({
    data: {
      roomId,
      folderId,
      uploadedById: session.user.id,
      title,
      fileName: file.name,
      mimeType: mime,
      size: file.size,
      publicPath,
    },
  });
  revalidateTasksAndRoomHub();
}

export async function deleteRoomDocument(documentId: string) {
  const session = await requireTasksRoomHubSession();
  const doc = await prisma.roomDocument.findUniqueOrThrow({
    where: { id: documentId },
    select: { publicPath: true, uploadedById: true, roomId: true },
  });
  const member = await assertRoomMember(doc.roomId, session.user.id);
  const canModerate = isRoomHubManagerRole(member.role);
  if (doc.uploadedById !== session.user.id && !canModerate) {
    throw new Error("Anda tidak dapat menghapus dokumen ini.");
  }
  if (!doc.publicPath.startsWith("/uploads/rooms/")) {
    throw new Error("Path tidak valid.");
  }
  const absFile = absolutePathFromStoredPublicPath(doc.publicPath);
  try {
    if (absFile) await unlink(absFile);
  } catch {
    /* file mungkin sudah hilang */
  }
  await prisma.roomDocument.delete({ where: { id: documentId } });
  revalidateTasksAndRoomHub();
}

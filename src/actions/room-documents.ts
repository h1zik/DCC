"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
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

export async function uploadRoomDocument(roomId: string, formData: FormData) {
  const session = await requireTasksRoomHubSession();
  const titleRaw = formData.get("title");
  const title =
    typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim() : null;
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("Pilih file terlebih dahulu.");
  }
  const mime = file.type || "application/octet-stream";
  if (!isAllowedMime(mime)) {
    throw new Error("Tipe file tidak diizinkan.");
  }

  await assertRoomMember(roomId, session.user.id);
  await prisma.room.findUniqueOrThrow({ where: { id: roomId } });

  const buf = Buffer.from(await file.arrayBuffer());
  const base = sanitizeBaseName(file.name);
  const stored = `${randomUUID()}-${base}`;
  const absDir = path.join(process.env.UPLOAD_PUBLIC_DIR || "/app/public/uploads", "rooms", roomId);
  await mkdir(absDir, { recursive: true });
  const absFile = path.join(absDir, stored);
  await writeFile(absFile, buf);

  const publicPath = `/uploads/rooms/${roomId}/${stored}`;
  await prisma.roomDocument.create({
    data: {
      roomId,
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
  const segs = doc.publicPath.split("/").filter(Boolean).slice(1);
  const absFile = path.join(process.env.UPLOAD_PUBLIC_DIR || "/app/public/uploads", ...segs);
  try {
    await unlink(absFile);
  } catch {
    /* file mungkin sudah hilang */
  }
  await prisma.roomDocument.delete({ where: { id: documentId } });
  revalidateTasksAndRoomHub();
}

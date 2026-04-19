"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import {
  assertRoomMemberHasTaskProcess,
  getTaskRoomContext,
  isRoomHubManagerRole,
} from "@/lib/room-access";

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

export async function uploadTaskAttachment(taskId: string, formData: FormData) {
  const session = await requireTasksRoomHubSession();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("Pilih file terlebih dahulu.");
  }
  const mime = file.type || "application/octet-stream";
  if (!isAllowedMime(mime)) {
    throw new Error("Tipe file tidak diizinkan (gambar, PDF, dokumen Office, zip, teks).");
  }

  const { roomId, roomProcess } = await getTaskRoomContext(taskId);
  await assertRoomMemberHasTaskProcess(roomId, session.user.id, roomProcess);

  const buf = Buffer.from(await file.arrayBuffer());
  const base = sanitizeBaseName(file.name);
  const stored = `${randomUUID()}-${base}`;
  const relDir = path.join("public", "uploads", "tasks", taskId);
  const absDir = path.join(process.cwd(), relDir);
  await mkdir(absDir, { recursive: true });
  const absFile = path.join(absDir, stored);
  await writeFile(absFile, buf);

  const publicPath = `/uploads/tasks/${taskId}/${stored}`;
  await prisma.taskAttachment.create({
    data: {
      taskId,
      uploadedById: session.user.id,
      fileName: file.name,
      mimeType: mime,
      size: file.size,
      publicPath,
    },
  });
  revalidateTasksAndRoomHub();
}

export async function deleteTaskAttachment(attachmentId: string) {
  const session = await requireTasksRoomHubSession();
  const a = await prisma.taskAttachment.findUniqueOrThrow({
    where: { id: attachmentId },
    select: { publicPath: true, uploadedById: true, taskId: true },
  });
  const { roomId, roomProcess } = await getTaskRoomContext(a.taskId);
  const member = await assertRoomMemberHasTaskProcess(
    roomId,
    session.user.id,
    roomProcess,
  );
  const canModerate = isRoomHubManagerRole(member.role);
  if (a.uploadedById !== session.user.id && !canModerate) {
    throw new Error("Anda tidak dapat menghapus lampiran ini.");
  }
  if (!a.publicPath.startsWith("/uploads/tasks/")) {
    throw new Error("Path tidak valid.");
  }
  const segs = a.publicPath.split("/").filter(Boolean);
  const absFile = path.join(process.cwd(), "public", ...segs);
  try {
    await unlink(absFile);
  } catch {
    /* file mungkin sudah dihapus manual */
  }
  await prisma.taskAttachment.delete({ where: { id: attachmentId } });
  revalidateTasksAndRoomHub();
}

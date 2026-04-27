"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import {
  absolutePathFromStoredPublicPath,
  getUploadPublicDir,
} from "@/lib/upload-storage";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";
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

const MAX_LINK_URL_CHARS = 2048;
const MAX_LINK_TITLE_CHARS = 200;
/** Bukan MIME IANA; penanda lampiran berupa URL di UI. */
const TASK_LINK_ATTACHMENT_MIME = "text/x-task-external-url";

function normalizeExternalTaskUrl(raw: string): string {
  const t = raw.trim();
  if (!t) throw new Error("Masukkan tautan.");
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    throw new Error("Format tautan tidak valid.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Hanya tautan http atau https yang diizinkan.");
  }
  const s = u.toString();
  if (s.length > MAX_LINK_URL_CHARS) {
    throw new Error(
      `Tautan terlalu panjang (maks. ${MAX_LINK_URL_CHARS} karakter).`,
    );
  }
  return s;
}

function defaultLinkTitle(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return (u.hostname + path).slice(0, MAX_LINK_TITLE_CHARS) || "Tautan";
  } catch {
    return "Tautan";
  }
}

/** Lampiran berupa URL (bukan unggahan file). */
export async function addTaskLinkAttachment(
  taskId: string,
  input: { url: string; title?: string | null },
) {
  const session = await requireTasksRoomHubSession();
  const linkUrl = normalizeExternalTaskUrl(input.url);
  const titleRaw =
    typeof input.title === "string" && input.title.trim()
      ? input.title.trim()
      : defaultLinkTitle(linkUrl);
  const fileName = titleRaw.slice(0, MAX_LINK_TITLE_CHARS);

  const { roomId, roomProcess } = await getTaskRoomContext(taskId);
  await assertRoomMemberHasTaskProcess(roomId, session.user.id, roomProcess);

  await prisma.taskAttachment.create({
    data: {
      taskId,
      uploadedById: session.user.id,
      fileName,
      mimeType: TASK_LINK_ATTACHMENT_MIME,
      size: 0,
      publicPath: null,
      linkUrl,
    },
  });
  revalidateTasksAndRoomHub();
}

export async function uploadTaskAttachment(taskId: string, formData: FormData) {
  const session = await requireTasksRoomHubSession();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("Pilih file terlebih dahulu.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file maksimal ${MAX_UPLOAD_LABEL}.`);
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
  const absDir = path.join(getUploadPublicDir(), "tasks", taskId);
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
    select: {
      publicPath: true,
      linkUrl: true,
      uploadedById: true,
      taskId: true,
    },
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
  if (a.publicPath) {
    if (!a.publicPath.startsWith("/uploads/tasks/")) {
      throw new Error("Path tidak valid.");
    }
    const absFile = absolutePathFromStoredPublicPath(a.publicPath);
    try {
      if (absFile) await unlink(absFile);
    } catch {
      /* file mungkin sudah dihapus manual */
    }
  } else if (!a.linkUrl) {
    throw new Error("Lampiran tidak valid.");
  }
  await prisma.taskAttachment.delete({ where: { id: attachmentId } });
  revalidateTasksAndRoomHub();
}

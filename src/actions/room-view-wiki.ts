"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";
import { getUploadPublicDir } from "@/lib/upload-storage";

async function ensureWikiMember(viewId: string, userId: string) {
  const v = await prisma.roomView.findUniqueOrThrow({
    where: { id: viewId },
    select: { roomId: true, type: true },
  });
  if (v.type !== "WIKI") throw new Error("View bukan tipe Wiki.");
  await assertRoomMember(v.roomId, userId);
  return v.roomId;
}

const upsertSchema = z.object({
  id: z.string().optional(),
  viewId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  content: z.string().max(50_000).optional().default(""),
});

export async function upsertRoomWikiPage(input: z.infer<typeof upsertSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = upsertSchema.parse(input);
  const roomId = await ensureWikiMember(data.viewId, session.user.id);

  let pageId = data.id;
  if (pageId) {
    await prisma.roomWikiPage.update({
      where: { id: pageId },
      data: {
        title: data.title,
        content: data.content ?? "",
        updatedById: session.user.id,
      },
    });
  } else {
    const max = await prisma.roomWikiPage.aggregate({
      where: { viewId: data.viewId },
      _max: { sortOrder: true },
    });
    const created = await prisma.roomWikiPage.create({
      data: {
        viewId: data.viewId,
        title: data.title,
        content: data.content ?? "",
        updatedById: session.user.id,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
    pageId = created.id;
  }
  revalidatePath(`/room/${roomId}/view/${data.viewId}`);
  return { id: pageId };
}

export async function deleteRoomWikiPage(pageId: string) {
  const session = await requireTasksRoomHubSession();
  const p = await prisma.roomWikiPage.findUniqueOrThrow({
    where: { id: pageId },
    select: { viewId: true },
  });
  const roomId = await ensureWikiMember(p.viewId, session.user.id);
  await prisma.roomWikiPage.delete({ where: { id: pageId } });
  revalidatePath(`/room/${roomId}/view/${p.viewId}`);
}

const WIKI_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
const WIKI_ATTACHMENT_ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/json",
  "application/msword",
  "application/vnd.ms-",
  "application/vnd.openxmlformats-officedocument",
  "text/plain",
  "text/csv",
  "audio/",
  "video/",
];

function isAllowedWikiAttachmentMime(mimeType: string): boolean {
  const mime = mimeType.toLowerCase();
  return WIKI_ATTACHMENT_ALLOWED_MIME.some((allowed) => mime.startsWith(allowed));
}

function safeWikiAttachmentName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function uploadRoomWikiAttachment(pageId: string, formData: FormData) {
  const session = await requireTasksRoomHubSession();
  const page = await prisma.roomWikiPage.findUniqueOrThrow({
    where: { id: pageId },
    select: { viewId: true },
  });
  const roomId = await ensureWikiMember(page.viewId, session.user.id);
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Pilih file terlebih dahulu.");
  if (file.size <= 0) throw new Error("File kosong tidak dapat diunggah.");
  if (file.size > WIKI_ATTACHMENT_MAX_BYTES) {
    throw new Error("Ukuran lampiran Wiki maksimal 25 MB.");
  }
  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedWikiAttachmentMime(mimeType)) {
    throw new Error("Tipe file tidak didukung atau berisiko dijalankan di browser.");
  }

  const storedName = `${randomUUID()}-${safeWikiAttachmentName(file.name)}`;
  const directory = path.join(getUploadPublicDir(), "wiki", pageId);
  const absolutePath = path.join(directory, storedName);
  const publicPath = `/uploads/wiki/${pageId}/${storedName}`;
  await mkdir(directory, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  try {
    await prisma.roomWikiAttachment.create({
      data: {
        pageId,
        uploadedById: session.user.id,
        fileName: file.name.slice(0, 240),
        mimeType,
        size: file.size,
        publicPath,
      },
    });
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }

  revalidatePath(`/room/${roomId}/view/${page.viewId}`);
  return { url: publicPath, name: file.name, mimeType, size: file.size };
}

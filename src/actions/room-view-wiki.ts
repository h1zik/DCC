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
  baseRevision: z.number().int().min(0).optional(),
});

const VERSION_CHECKPOINT_MS = 60_000;

type SaveConflict = {
  conflict: true;
  id: string;
  revision: number;
  title: string;
  content: string;
  updatedAt: string;
};

export async function upsertRoomWikiPage(input: z.infer<typeof upsertSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = upsertSchema.parse(input);
  const roomId = await ensureWikiMember(data.viewId, session.user.id);

  if (data.id) {
    const current = await prisma.roomWikiPage.findFirst({
      where: { id: data.id, viewId: data.viewId },
      select: {
        id: true,
        title: true,
        content: true,
        revision: true,
        updatedAt: true,
      },
    });
    if (!current) throw new Error("Halaman Wiki tidak ditemukan pada view ini.");
    if (data.baseRevision != null && data.baseRevision !== current.revision) {
      return {
        conflict: true,
        id: current.id,
        revision: current.revision,
        title: current.title,
        content: current.content,
        updatedAt: current.updatedAt.toISOString(),
      } satisfies SaveConflict;
    }
    if (current.title === data.title && current.content === data.content) {
      return {
        conflict: false as const,
        id: current.id,
        revision: current.revision,
        updatedAt: current.updatedAt.toISOString(),
      };
    }

    const latestVersion = await prisma.roomWikiPageVersion.findFirst({
      where: { pageId: current.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const nextRevision = current.revision + 1;
    const shouldCheckpoint =
      !latestVersion || Date.now() - latestVersion.createdAt.getTime() >= VERSION_CHECKPOINT_MS;

    const updated = await prisma.$transaction(async (tx) => {
      const guarded = await tx.roomWikiPage.updateMany({
        where: { id: current.id, viewId: data.viewId, revision: current.revision },
        data: {
          title: data.title,
          content: data.content,
          revision: nextRevision,
          updatedById: session.user.id,
        },
      });
      if (guarded.count !== 1) return null;
      if (shouldCheckpoint) {
        await tx.roomWikiPageVersion.create({
          data: {
            pageId: current.id,
            revision: nextRevision,
            title: data.title,
            content: data.content,
            createdById: session.user.id,
          },
        });
      }
      return tx.roomWikiPage.findUniqueOrThrow({
        where: { id: current.id },
        select: { revision: true, updatedAt: true },
      });
    });

    if (!updated) {
      const latest = await prisma.roomWikiPage.findUniqueOrThrow({
        where: { id: current.id },
        select: { id: true, revision: true, title: true, content: true, updatedAt: true },
      });
      return {
        conflict: true,
        id: latest.id,
        revision: latest.revision,
        title: latest.title,
        content: latest.content,
        updatedAt: latest.updatedAt.toISOString(),
      } satisfies SaveConflict;
    }
    revalidatePath(`/room/${roomId}/view/${data.viewId}`);
    return {
      conflict: false as const,
      id: current.id,
      revision: updated.revision,
      updatedAt: updated.updatedAt.toISOString(),
    };
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
        versions: {
          create: {
            revision: 0,
            title: data.title,
            content: data.content,
            createdById: session.user.id,
            reason: "initial",
          },
        },
      },
      select: { id: true, revision: true, updatedAt: true },
    });
    revalidatePath(`/room/${roomId}/view/${data.viewId}`);
    return {
      conflict: false as const,
      id: created.id,
      revision: created.revision,
      updatedAt: created.updatedAt.toISOString(),
    };
  }
}

export async function listRoomWikiPageVersions(pageId: string) {
  const session = await requireTasksRoomHubSession();
  const page = await prisma.roomWikiPage.findUniqueOrThrow({
    where: { id: pageId },
    select: { viewId: true },
  });
  await ensureWikiMember(page.viewId, session.user.id);
  const versions = await prisma.roomWikiPageVersion.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      revision: true,
      title: true,
      content: true,
      reason: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true, image: true } },
    },
  });
  return versions.map((version) => ({
    ...version,
    createdAt: version.createdAt.toISOString(),
  }));
}

export async function restoreRoomWikiPageVersion(pageId: string, versionId: string) {
  const session = await requireTasksRoomHubSession();
  const page = await prisma.roomWikiPage.findUniqueOrThrow({
    where: { id: pageId },
    select: { viewId: true, revision: true },
  });
  const roomId = await ensureWikiMember(page.viewId, session.user.id);
  const version = await prisma.roomWikiPageVersion.findFirst({
    where: { id: versionId, pageId },
    select: { title: true, content: true },
  });
  if (!version) throw new Error("Versi Wiki tidak ditemukan.");
  const nextRevision = page.revision + 1;
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.roomWikiPage.update({
      where: { id: pageId },
      data: {
        title: version.title,
        content: version.content,
        revision: nextRevision,
        updatedById: session.user.id,
      },
      select: { updatedAt: true },
    });
    await tx.roomWikiPageVersion.create({
      data: {
        pageId,
        revision: nextRevision,
        title: version.title,
        content: version.content,
        createdById: session.user.id,
        reason: "restore",
      },
    });
    return row;
  });
  revalidatePath(`/room/${roomId}/view/${page.viewId}`);
  return { revision: nextRevision, updatedAt: updated.updatedAt.toISOString() };
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

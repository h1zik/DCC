"use server";

import { unlink } from "node:fs/promises";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { absolutePathFromStoredPublicPath } from "@/lib/upload-storage";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { assertRoomMember, isRoomHubManagerRole } from "@/lib/room-access";
import { saveRoomDocumentToStorageAndDb } from "@/lib/room-document-upload";
import {
  normalizeRoomDocumentTags,
  ROOM_DOCUMENT_TAG_LIMITS,
} from "@/lib/room-document-tags";

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

async function resolveUploadFolderId(
  roomId: string,
  folderIdRaw: unknown,
): Promise<string | null> {
  if (typeof folderIdRaw !== "string" || !folderIdRaw.trim()) return null;
  const fid = folderIdRaw.trim();
  const f = await prisma.roomDocumentFolder.findFirst({
    where: { id: fid, roomId },
  });
  if (!f) {
    throw new Error("Folder tidak ditemukan di ruangan ini.");
  }
  return fid;
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

  await assertRoomMember(roomId, session.user.id);
  await prisma.room.findUniqueOrThrow({ where: { id: roomId } });

  const folderId = await resolveUploadFolderId(roomId, formData.get("folderId"));

  const tagsRaw = formData.get("tags");
  let tags: string[] = [];
  if (typeof tagsRaw === "string" && tagsRaw.trim()) {
    try {
      const parsed = JSON.parse(tagsRaw) as unknown;
      if (Array.isArray(parsed)) {
        tags = normalizeRoomDocumentTags(
          parsed.filter((x): x is string => typeof x === "string"),
        );
      }
    } catch {
      /* abaikan JSON rusak */
    }
  }

  const buf = Buffer.from(await file.arrayBuffer());
  await saveRoomDocumentToStorageAndDb({
    roomId,
    uploadedById: session.user.id,
    folderId,
    title,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    buffer: buf,
    tags: tags.length ? tags : undefined,
  });

  revalidateTasksAndRoomHub();
}

const updateTagsSchema = z.object({
  documentId: z.string().min(1),
  tags: z.array(z.string()).max(ROOM_DOCUMENT_TAG_LIMITS.maxTags),
});

export async function updateRoomDocumentTags(
  input: z.infer<typeof updateTagsSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = updateTagsSchema.parse(input);
  const tags = normalizeRoomDocumentTags(data.tags);

  const doc = await prisma.roomDocument.findUniqueOrThrow({
    where: { id: data.documentId },
    select: { roomId: true, uploadedById: true },
  });
  const m = await assertRoomMember(doc.roomId, session.user.id);
  const canModerate = isRoomHubManagerRole(m.role);
  if (doc.uploadedById !== session.user.id && !canModerate) {
    throw new Error("Anda tidak dapat mengubah tag dokumen ini.");
  }

  await prisma.roomDocument.update({
    where: { id: data.documentId },
    data: { tags },
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

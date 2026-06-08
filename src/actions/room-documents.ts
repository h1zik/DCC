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
  /** Null = folder di root drive ruangan. */
  parentId?: string | null;
}): Promise<{ id: string }> {
  const session = await requireTasksRoomHubSession();
  const name = folderNameSchema.parse(input.name);
  const parentId = input.parentId ?? null;
  await assertRoomMember(input.roomId, session.user.id);
  if (parentId != null) {
    const parent = await prisma.roomDocumentFolder.findFirst({
      where: { id: parentId, roomId: input.roomId },
      select: { id: true },
    });
    if (!parent) throw new Error("Folder induk tidak valid.");
  }
  const dup = await prisma.roomDocumentFolder.findFirst({
    where: {
      roomId: input.roomId,
      parentId,
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (dup) {
    throw new Error("Sudah ada folder dengan nama yang sama di lokasi ini.");
  }
  const max = await prisma.roomDocumentFolder.aggregate({
    where: { roomId: input.roomId, parentId },
    _max: { sortOrder: true },
  });
  const row = await prisma.roomDocumentFolder.create({
    data: {
      roomId: input.roomId,
      parentId,
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
    select: { roomId: true, parentId: true },
  });
  const m = await assertRoomMember(folder.roomId, session.user.id);
  if (!isRoomHubManagerRole(m.role)) {
    throw new Error("Hanya manager ruangan yang dapat mengganti nama folder.");
  }
  const dup = await prisma.roomDocumentFolder.findFirst({
    where: {
      roomId: folder.roomId,
      parentId: folder.parentId,
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
    select: {
      roomId: true,
      _count: { select: { children: true, documents: true } },
    },
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

export async function listRoomDocumentFoldersForPicker(roomId: string) {
  const session = await requireTasksRoomHubSession();
  await assertRoomMember(roomId, session.user.id);

  return prisma.roomDocumentFolder.findMany({
    where: { roomId },
    select: { id: true, name: true, parentId: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function resolveUploadFolderId(
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

  await saveRoomDocumentToStorageAndDb({
    roomId,
    uploadedById: session.user.id,
    folderId,
    title,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    body: file.stream(),
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

const bulkDocIdsSchema = z
  .array(z.string().min(1))
  .min(1, "Pilih minimal satu file.")
  .max(200, "Maksimal 200 file sekaligus.");

export async function deleteRoomDocuments(documentIds: string[]) {
  const session = await requireTasksRoomHubSession();
  const ids = bulkDocIdsSchema.parse(documentIds);
  const docs = await prisma.roomDocument.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      publicPath: true,
      thumbPath: true,
      uploadedById: true,
      roomId: true,
    },
  });
  if (docs.length === 0) throw new Error("Dokumen tidak ditemukan.");
  const roomId = docs[0]!.roomId;
  if (docs.some((d) => d.roomId !== roomId)) {
    throw new Error("Semua file harus dari ruangan yang sama.");
  }
  const m = await assertRoomMember(roomId, session.user.id);
  const canModerate = isRoomHubManagerRole(m.role);
  for (const doc of docs) {
    if (doc.uploadedById !== session.user.id && !canModerate) {
      throw new Error("Anda tidak dapat menghapus satu atau lebih file terpilih.");
    }
  }
  for (const doc of docs) {
    if (!doc.publicPath.startsWith("/uploads/rooms/")) {
      throw new Error("Path tidak valid.");
    }
    const absFile = absolutePathFromStoredPublicPath(doc.publicPath);
    const absThumb = doc.thumbPath
      ? absolutePathFromStoredPublicPath(doc.thumbPath)
      : null;
    try {
      if (absFile) await unlink(absFile);
    } catch {
      /* abaikan */
    }
    if (absThumb) {
      try {
        await unlink(absThumb);
      } catch {
        /* abaikan */
      }
    }
    await prisma.roomDocument.delete({ where: { id: doc.id } });
  }
  revalidateTasksAndRoomHub();
  return { deleted: docs.length };
}

const bulkMoveSchema = z.object({
  documentIds: bulkDocIdsSchema,
  folderId: z.union([z.string().min(1), z.null()]),
});

export async function moveRoomDocumentsToFolder(
  input: z.infer<typeof bulkMoveSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = bulkMoveSchema.parse(input);
  const docs = await prisma.roomDocument.findMany({
    where: { id: { in: data.documentIds } },
    select: {
      id: true,
      roomId: true,
      uploadedById: true,
      folderId: true,
    },
  });
  if (docs.length === 0) throw new Error("Dokumen tidak ditemukan.");
  const roomId = docs[0]!.roomId;
  if (docs.some((d) => d.roomId !== roomId)) {
    throw new Error("Semua file harus dari ruangan yang sama.");
  }
  const m = await assertRoomMember(roomId, session.user.id);
  const canModerate = isRoomHubManagerRole(m.role);
  for (const doc of docs) {
    if (doc.uploadedById !== session.user.id && !canModerate) {
      throw new Error("Anda tidak dapat memindahkan satu atau lebih file terpilih.");
    }
  }
  if (data.folderId != null) {
    const f = await prisma.roomDocumentFolder.findFirst({
      where: { id: data.folderId, roomId },
    });
    if (!f) throw new Error("Folder tidak valid.");
  }
  await prisma.roomDocument.updateMany({
    where: { id: { in: data.documentIds } },
    data: { folderId: data.folderId },
  });
  revalidateTasksAndRoomHub();
  return { moved: docs.length };
}

export async function deleteRoomDocument(documentId: string) {
  const session = await requireTasksRoomHubSession();
  const doc = await prisma.roomDocument.findUniqueOrThrow({
    where: { id: documentId },
    select: {
      publicPath: true,
      thumbPath: true,
      uploadedById: true,
      roomId: true,
    },
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
  const absThumb = doc.thumbPath
    ? absolutePathFromStoredPublicPath(doc.thumbPath)
    : null;
  try {
    if (absFile) await unlink(absFile);
  } catch {
    /* file mungkin sudah hilang */
  }
  if (absThumb) {
    try {
      await unlink(absThumb);
    } catch {
      /* thumbnail mungkin sudah hilang / tidak pernah dibuat */
    }
  }
  await prisma.roomDocument.delete({ where: { id: documentId } });
  revalidateTasksAndRoomHub();
}

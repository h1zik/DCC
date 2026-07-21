"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { assertRoomMember, isRoomHubManagerRole } from "@/lib/room-access";
import { saveRoomDocumentToStorageAndDb } from "@/lib/room-document-upload";
import {
  normalizeRoomDocumentTags,
  ROOM_DOCUMENT_TAG_LIMITS,
} from "@/lib/room-document-tags";
import { getDescendantFolderIds } from "@/lib/room-document-folders";
import { logRoomDocumentActivity } from "@/lib/room-document-activity";
import {
  canEditRoomDocument,
  canEditRoomDocumentFolder,
} from "@/lib/room-document-permissions";

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
      where: { id: parentId, roomId: input.roomId, trashedAt: null },
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
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.roomDocumentFolder.create({
      data: {
        roomId: input.roomId,
        parentId,
        name,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
    await logRoomDocumentActivity(tx, {
      roomId: input.roomId,
      actorId: session.user.id,
      action: "CREATED",
      targetName: name,
      folderId: created.id,
    });
    return created;
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
  const folder = await prisma.roomDocumentFolder.findFirstOrThrow({
    where: { id: input.folderId, trashedAt: null },
    select: { id: true, roomId: true, parentId: true, name: true },
  });
  const m = await assertRoomMember(folder.roomId, session.user.id);
  const allowed = await canEditRoomDocumentFolder(prisma, {
    roomId: folder.roomId,
    folderId: folder.id,
    userId: session.user.id,
    isManager: isRoomHubManagerRole(m.role),
  });
  if (!allowed) {
    throw new Error("Anda tidak dapat mengganti nama folder ini.");
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
  await prisma.$transaction(async (tx) => {
    await tx.roomDocumentFolder.update({
      where: { id: input.folderId },
      data: { name },
    });
    await logRoomDocumentActivity(tx, {
      roomId: folder.roomId,
      actorId: session.user.id,
      action: "RENAMED",
      targetName: name,
      folderId: folder.id,
      detail: { previousName: folder.name },
    });
  });
  revalidateTasksAndRoomHub();
}

export async function deleteRoomDocumentFolder(folderId: string) {
  const session = await requireTasksRoomHubSession();
  const folder = await prisma.roomDocumentFolder.findFirstOrThrow({
    where: { id: folderId, trashedAt: null },
    select: {
      id: true,
      roomId: true,
      name: true,
      _count: { select: { children: true, documents: true } },
    },
  });
  const m = await assertRoomMember(folder.roomId, session.user.id);
  const allowed = await canEditRoomDocumentFolder(prisma, {
    roomId: folder.roomId,
    folderId: folder.id,
    userId: session.user.id,
    isManager: isRoomHubManagerRole(m.role),
  });
  if (!allowed) {
    throw new Error("Anda tidak dapat menghapus folder ini.");
  }
  const roomFolders = await prisma.roomDocumentFolder.findMany({
    where: { roomId: folder.roomId },
    select: { id: true, name: true, parentId: true, sortOrder: true },
  });
  const subtreeIds = [
    folder.id,
    ...getDescendantFolderIds(roomFolders, folder.id),
  ];
  const trashedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.roomDocumentFolder.updateMany({
      where: { id: { in: subtreeIds } },
      data: { trashedAt, trashedById: session.user.id },
    });
    await logRoomDocumentActivity(tx, {
      roomId: folder.roomId,
      actorId: session.user.id,
      action: "TRASHED",
      targetName: folder.name,
      folderId: folder.id,
    });
  });
  revalidateTasksAndRoomHub();
  return { trashed: true };
}

const moveFolderSchema = z.object({
  folderId: z.string().min(1),
  parentId: z.union([z.string().min(1), z.null()]),
});

/**
 * Memindahkan satu subtree folder. File dan subfolder ikut secara otomatis
 * karena relasinya tetap menunjuk ke folder yang sama.
 */
export async function moveRoomDocumentFolder(
  input: z.infer<typeof moveFolderSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = moveFolderSchema.parse(input);
  const folder = await prisma.roomDocumentFolder.findFirstOrThrow({
    where: { id: data.folderId, trashedAt: null },
    select: { id: true, roomId: true, parentId: true, name: true },
  });
  const member = await assertRoomMember(folder.roomId, session.user.id);
  const allowed = await canEditRoomDocumentFolder(prisma, {
    roomId: folder.roomId,
    folderId: folder.id,
    userId: session.user.id,
    isManager: isRoomHubManagerRole(member.role),
  });
  if (!allowed) {
    throw new Error("Anda tidak dapat memindahkan folder ini.");
  }
  if (data.parentId === folder.parentId) return { moved: false };
  if (data.parentId === folder.id) {
    throw new Error("Folder tidak dapat dipindahkan ke dalam dirinya sendiri.");
  }

  const roomFolders = await prisma.roomDocumentFolder.findMany({
    where: { roomId: folder.roomId, trashedAt: null },
    select: { id: true, name: true, parentId: true, sortOrder: true },
  });
  if (
    data.parentId != null &&
    !roomFolders.some((candidate) => candidate.id === data.parentId)
  ) {
    throw new Error("Folder tujuan tidak valid.");
  }

  const descendants = getDescendantFolderIds(roomFolders, folder.id);
  if (data.parentId != null && descendants.has(data.parentId)) {
    throw new Error("Folder tidak dapat dipindahkan ke dalam subfoldernya sendiri.");
  }

  const duplicate = roomFolders.some(
    (candidate) =>
      candidate.id !== folder.id &&
      candidate.parentId === data.parentId &&
      candidate.name.localeCompare(folder.name, "id", {
        sensitivity: "base",
      }) === 0,
  );
  if (duplicate) {
    throw new Error("Sudah ada folder dengan nama yang sama di lokasi tujuan.");
  }

  const nextSortOrder = roomFolders.reduce(
    (max, candidate) =>
      candidate.parentId === data.parentId
        ? Math.max(max, candidate.sortOrder)
        : max,
    -1,
  ) + 1;
  await prisma.$transaction(async (tx) => {
    await tx.roomDocumentFolder.update({
      where: { id: folder.id },
      data: { parentId: data.parentId, sortOrder: nextSortOrder },
    });
    await logRoomDocumentActivity(tx, {
      roomId: folder.roomId,
      actorId: session.user.id,
      action: "MOVED",
      targetName: folder.name,
      folderId: folder.id,
      detail: { fromFolderId: folder.parentId, toFolderId: data.parentId },
    });
  });
  revalidateTasksAndRoomHub();
  return { moved: true };
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
  const doc = await prisma.roomDocument.findFirstOrThrow({
    where: {
      id: data.documentId,
      trashedAt: null,
      OR: [{ folderId: null }, { folder: { trashedAt: null } }],
    },
    select: { roomId: true, uploadedById: true, folderId: true },
  });
  const m = await assertRoomMember(doc.roomId, session.user.id);
  const allowed = await canEditRoomDocument(prisma, {
    ...doc,
    documentId: data.documentId,
    userId: session.user.id,
    isManager: isRoomHubManagerRole(m.role),
  });
  if (!allowed) {
    throw new Error("Anda tidak dapat memindahkan dokumen ini.");
  }
  if (data.folderId != null) {
    const f = await prisma.roomDocumentFolder.findFirst({
      where: { id: data.folderId, roomId: doc.roomId, trashedAt: null },
    });
    if (!f) throw new Error("Folder tidak valid.");
  }
  if (data.folderId === doc.folderId) return;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.roomDocument.update({
      where: { id: data.documentId },
      data: { folderId: data.folderId },
      select: { title: true, fileName: true },
    });
    await logRoomDocumentActivity(tx, {
      roomId: doc.roomId,
      actorId: session.user.id,
      action: "MOVED",
      targetName: updated.title || updated.fileName,
      documentId: data.documentId,
      detail: { fromFolderId: doc.folderId, toFolderId: data.folderId },
    });
  });
  revalidateTasksAndRoomHub();
}

export async function listRoomDocumentFoldersForPicker(roomId: string) {
  const session = await requireTasksRoomHubSession();
  await assertRoomMember(roomId, session.user.id);

  return prisma.roomDocumentFolder.findMany({
    where: { roomId, trashedAt: null },
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
    where: { id: fid, roomId, trashedAt: null },
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

  const doc = await prisma.roomDocument.findFirstOrThrow({
    where: {
      id: data.documentId,
      trashedAt: null,
      OR: [{ folderId: null }, { folder: { trashedAt: null } }],
    },
    select: { roomId: true, uploadedById: true, folderId: true },
  });
  const m = await assertRoomMember(doc.roomId, session.user.id);
  const allowed = await canEditRoomDocument(prisma, {
    ...doc,
    documentId: data.documentId,
    userId: session.user.id,
    isManager: isRoomHubManagerRole(m.role),
  });
  if (!allowed) {
    throw new Error("Anda tidak dapat mengubah tag dokumen ini.");
  }

  await prisma.roomDocument.update({
    where: { id: data.documentId },
    data: { tags },
  });
  revalidateTasksAndRoomHub();
}

const renameDocSchema = z.object({
  documentId: z.string().min(1),
  title: z.string().max(200),
});

export async function renameRoomDocument(
  input: z.infer<typeof renameDocSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = renameDocSchema.parse(input);
  const title = data.title.trim();

  const doc = await prisma.roomDocument.findFirstOrThrow({
    where: {
      id: data.documentId,
      trashedAt: null,
      OR: [{ folderId: null }, { folder: { trashedAt: null } }],
    },
    select: {
      roomId: true,
      uploadedById: true,
      folderId: true,
      title: true,
      fileName: true,
    },
  });
  const m = await assertRoomMember(doc.roomId, session.user.id);
  const allowed = await canEditRoomDocument(prisma, {
    ...doc,
    documentId: data.documentId,
    userId: session.user.id,
    isManager: isRoomHubManagerRole(m.role),
  });
  if (!allowed) {
    throw new Error("Anda tidak dapat mengganti nama dokumen ini.");
  }

  // Nama tampilan (title); file fisik `fileName` tidak diubah. Kosong = fallback
  // ke nama file asli.
  await prisma.$transaction(async (tx) => {
    await tx.roomDocument.update({
      where: { id: data.documentId },
      data: { title: title || null },
    });
    await logRoomDocumentActivity(tx, {
      roomId: doc.roomId,
      actorId: session.user.id,
      action: "RENAMED",
      targetName: title || doc.fileName,
      documentId: data.documentId,
      detail: { previousName: doc.title || doc.fileName },
    });
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
    where: { id: { in: ids }, trashedAt: null },
    select: {
      id: true,
      uploadedById: true,
      roomId: true,
      folderId: true,
      title: true,
      fileName: true,
    },
  });
  if (docs.length !== new Set(ids).size) {
    throw new Error("Satu atau lebih dokumen tidak ditemukan.");
  }
  const roomId = docs[0]!.roomId;
  if (docs.some((d) => d.roomId !== roomId)) {
    throw new Error("Semua file harus dari ruangan yang sama.");
  }
  const m = await assertRoomMember(roomId, session.user.id);
  const canModerate = isRoomHubManagerRole(m.role);
  for (const doc of docs) {
    const allowed = await canEditRoomDocument(prisma, {
      roomId,
      documentId: doc.id,
      folderId: doc.folderId,
      uploadedById: doc.uploadedById,
      userId: session.user.id,
      isManager: canModerate,
    });
    if (!allowed) {
      throw new Error("Anda tidak dapat menghapus satu atau lebih file terpilih.");
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.roomDocument.updateMany({
      where: { id: { in: docs.map((doc) => doc.id) } },
      data: { trashedAt: new Date(), trashedById: session.user.id },
    });
    for (const doc of docs) {
      await logRoomDocumentActivity(tx, {
        roomId,
        actorId: session.user.id,
        action: "TRASHED",
        targetName: doc.title || doc.fileName,
        documentId: doc.id,
      });
    }
  });
  revalidateTasksAndRoomHub();
  return { trashed: docs.length };
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
    where: {
      id: { in: data.documentIds },
      trashedAt: null,
      OR: [{ folderId: null }, { folder: { trashedAt: null } }],
    },
    select: {
      id: true,
      roomId: true,
      uploadedById: true,
      folderId: true,
    },
  });
  if (docs.length !== new Set(data.documentIds).size) {
    throw new Error("Satu atau lebih dokumen tidak ditemukan.");
  }
  const roomId = docs[0]!.roomId;
  if (docs.some((d) => d.roomId !== roomId)) {
    throw new Error("Semua file harus dari ruangan yang sama.");
  }
  const m = await assertRoomMember(roomId, session.user.id);
  const canModerate = isRoomHubManagerRole(m.role);
  for (const doc of docs) {
    const allowed = await canEditRoomDocument(prisma, {
      roomId,
      documentId: doc.id,
      folderId: doc.folderId,
      uploadedById: doc.uploadedById,
      userId: session.user.id,
      isManager: canModerate,
    });
    if (!allowed) {
      throw new Error("Anda tidak dapat memindahkan satu atau lebih file terpilih.");
    }
  }
  if (data.folderId != null) {
    const f = await prisma.roomDocumentFolder.findFirst({
      where: { id: data.folderId, roomId, trashedAt: null },
    });
    if (!f) throw new Error("Folder tidak valid.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.roomDocument.updateMany({
      where: { id: { in: data.documentIds } },
      data: { folderId: data.folderId },
    });
    for (const doc of docs) {
      await logRoomDocumentActivity(tx, {
        roomId,
        actorId: session.user.id,
        action: "MOVED",
        targetName: doc.id,
        documentId: doc.id,
        detail: { fromFolderId: doc.folderId, toFolderId: data.folderId },
      });
    }
  });
  revalidateTasksAndRoomHub();
  return { moved: docs.length };
}

const mixedMoveSchema = z.object({
  documentIds: z.array(z.string().min(1)).max(200),
  folderIds: z.array(z.string().min(1)).max(100),
  targetFolderId: z.string().min(1).nullable(),
}).refine((value) => value.documentIds.length + value.folderIds.length > 0, {
  message: "Pilih minimal satu item.",
});

export async function moveRoomDocumentItems(input: z.infer<typeof mixedMoveSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = mixedMoveSchema.parse(input);
  const [documents, selectedFolders] = await Promise.all([
    prisma.roomDocument.findMany({
      where: { id: { in: data.documentIds }, trashedAt: null },
      select: { id: true, roomId: true, folderId: true, uploadedById: true, title: true, fileName: true },
    }),
    prisma.roomDocumentFolder.findMany({
      where: { id: { in: data.folderIds }, trashedAt: null },
      select: { id: true, roomId: true, parentId: true, name: true, sortOrder: true },
    }),
  ]);
  if (
    documents.length !== new Set(data.documentIds).size ||
    selectedFolders.length !== new Set(data.folderIds).size
  ) {
    throw new Error("Satu atau lebih item tidak ditemukan.");
  }
  const roomId = documents[0]?.roomId ?? selectedFolders[0]?.roomId;
  if (!roomId) throw new Error("Item tidak ditemukan.");
  if ([...documents, ...selectedFolders].some((item) => item.roomId !== roomId)) {
    throw new Error("Semua item harus berasal dari ruangan yang sama.");
  }
  const member = await assertRoomMember(roomId, session.user.id);
  const isManager = isRoomHubManagerRole(member.role);
  for (const document of documents) {
    if (!(await canEditRoomDocument(prisma, {
      roomId,
      documentId: document.id,
      folderId: document.folderId,
      uploadedById: document.uploadedById,
      userId: session.user.id,
      isManager,
    }))) throw new Error("Anda tidak dapat memindahkan satu atau lebih file.");
  }
  for (const folder of selectedFolders) {
    if (!(await canEditRoomDocumentFolder(prisma, {
      roomId,
      folderId: folder.id,
      userId: session.user.id,
      isManager,
    }))) throw new Error("Anda tidak dapat memindahkan satu atau lebih folder.");
  }
  const allFolders = await prisma.roomDocumentFolder.findMany({
    where: { roomId, trashedAt: null },
    select: { id: true, name: true, parentId: true, sortOrder: true },
  });
  if (data.targetFolderId && !allFolders.some((folder) => folder.id === data.targetFolderId)) {
    throw new Error("Folder tujuan tidak valid.");
  }
  const selectedIds = new Set(selectedFolders.map((folder) => folder.id));
  const topFolders = selectedFolders.filter((folder) => {
    let parentId = folder.parentId;
    while (parentId) {
      if (selectedIds.has(parentId)) return false;
      parentId = allFolders.find((candidate) => candidate.id === parentId)?.parentId ?? null;
    }
    return true;
  });
  for (const folder of topFolders) {
    if (data.targetFolderId === folder.id || (data.targetFolderId && getDescendantFolderIds(allFolders, folder.id).has(data.targetFolderId))) {
      throw new Error(`Folder “${folder.name}” tidak dapat dipindahkan ke dalam dirinya sendiri.`);
    }
    const duplicate = allFolders.some((candidate) =>
      candidate.id !== folder.id &&
      !selectedIds.has(candidate.id) &&
      candidate.parentId === data.targetFolderId &&
      candidate.name.localeCompare(folder.name, "id", { sensitivity: "base" }) === 0,
    );
    if (duplicate) throw new Error(`Folder “${folder.name}” sudah ada di lokasi tujuan.`);
  }
  await prisma.$transaction(async (tx) => {
    if (documents.length > 0) {
      await tx.roomDocument.updateMany({
        where: { id: { in: documents.map((document) => document.id) } },
        data: { folderId: data.targetFolderId },
      });
    }
    let sortOrder = allFolders
      .filter((folder) => folder.parentId === data.targetFolderId)
      .reduce((max, folder) => Math.max(max, folder.sortOrder), -1) + 1;
    for (const folder of topFolders) {
      await tx.roomDocumentFolder.update({
        where: { id: folder.id },
        data: { parentId: data.targetFolderId, sortOrder: sortOrder++ },
      });
    }
    for (const document of documents) {
      await logRoomDocumentActivity(tx, {
        roomId,
        actorId: session.user.id,
        action: "MOVED",
        targetName: document.title || document.fileName,
        documentId: document.id,
        detail: { fromFolderId: document.folderId, toFolderId: data.targetFolderId },
      });
    }
    for (const folder of topFolders) {
      await logRoomDocumentActivity(tx, {
        roomId,
        actorId: session.user.id,
        action: "MOVED",
        targetName: folder.name,
        folderId: folder.id,
        detail: { fromFolderId: folder.parentId, toFolderId: data.targetFolderId },
      });
    }
  });
  revalidateTasksAndRoomHub();
  return { movedDocuments: documents.length, movedFolders: topFolders.length };
}

export async function deleteRoomDocument(documentId: string) {
  const session = await requireTasksRoomHubSession();
  const doc = await prisma.roomDocument.findFirstOrThrow({
    where: {
      id: documentId,
      trashedAt: null,
      OR: [{ folderId: null }, { folder: { trashedAt: null } }],
    },
    select: {
      publicPath: true,
      thumbPath: true,
      uploadedById: true,
      roomId: true,
      folderId: true,
      title: true,
      fileName: true,
    },
  });
  const member = await assertRoomMember(doc.roomId, session.user.id);
  const allowed = await canEditRoomDocument(prisma, {
    roomId: doc.roomId,
    documentId,
    folderId: doc.folderId,
    uploadedById: doc.uploadedById,
    userId: session.user.id,
    isManager: isRoomHubManagerRole(member.role),
  });
  if (!allowed) {
    throw new Error("Anda tidak dapat menghapus dokumen ini.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.roomDocument.update({
      where: { id: documentId },
      data: { trashedAt: new Date(), trashedById: session.user.id },
    });
    await logRoomDocumentActivity(tx, {
      roomId: doc.roomId,
      actorId: session.user.id,
      action: "TRASHED",
      targetName: doc.title || doc.fileName,
      documentId,
    });
  });
  revalidateTasksAndRoomHub();
  return { trashed: true };
}

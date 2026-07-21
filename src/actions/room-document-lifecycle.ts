"use server";

import { unlink } from "node:fs/promises";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember, isRoomHubManagerRole } from "@/lib/room-access";
import { absolutePathFromStoredPublicPath } from "@/lib/upload-storage";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { getDescendantFolderIds } from "@/lib/room-document-folders";
import { logRoomDocumentActivity } from "@/lib/room-document-activity";
import {
  canEditRoomDocument,
  canEditRoomDocumentFolder,
} from "@/lib/room-document-permissions";

const idsSchema = z.array(z.string().min(1)).min(1).max(200);

async function removeStoredFiles(paths: Array<string | null | undefined>) {
  const unique = new Set(paths.filter((path): path is string => Boolean(path)));
  for (const publicPath of unique) {
    const absolutePath = absolutePathFromStoredPublicPath(publicPath);
    if (absolutePath) await unlink(absolutePath).catch(() => undefined);
  }
}

export async function restoreRoomDocuments(documentIds: string[]) {
  const session = await requireTasksRoomHubSession();
  const ids = idsSchema.parse(documentIds);
  const docs = await prisma.roomDocument.findMany({
    where: { id: { in: ids }, trashedAt: { not: null } },
    select: {
      id: true,
      roomId: true,
      folderId: true,
      uploadedById: true,
      title: true,
      fileName: true,
      folder: { select: { trashedAt: true } },
    },
  });
  if (docs.length === 0) throw new Error("File di Sampah tidak ditemukan.");
  const roomId = docs[0]!.roomId;
  if (docs.some((doc) => doc.roomId !== roomId)) {
    throw new Error("Semua file harus berasal dari ruangan yang sama.");
  }
  const member = await assertRoomMember(roomId, session.user.id);
  const isManager = isRoomHubManagerRole(member.role);
  for (const doc of docs) {
    const allowed = await canEditRoomDocument(prisma, {
      roomId,
      documentId: doc.id,
      folderId: doc.folderId,
      uploadedById: doc.uploadedById,
      userId: session.user.id,
      isManager,
    });
    if (!allowed) throw new Error("Anda tidak dapat memulihkan satu atau lebih file.");
  }
  await prisma.$transaction(async (tx) => {
    for (const doc of docs) {
      await tx.roomDocument.update({
        where: { id: doc.id },
        data: {
          trashedAt: null,
          trashedById: null,
          folderId: doc.folder?.trashedAt ? null : doc.folderId,
        },
      });
      await logRoomDocumentActivity(tx, {
        roomId,
        actorId: session.user.id,
        action: "RESTORED",
        targetName: doc.title || doc.fileName,
        documentId: doc.id,
      });
    }
  });
  revalidateTasksAndRoomHub();
  return { restored: docs.length };
}

export async function restoreRoomDocumentFolder(folderId: string) {
  const session = await requireTasksRoomHubSession();
  const folder = await prisma.roomDocumentFolder.findUniqueOrThrow({
    where: { id: folderId },
    select: {
      id: true,
      roomId: true,
      parentId: true,
      name: true,
      trashedAt: true,
      parent: { select: { trashedAt: true } },
    },
  });
  if (!folder.trashedAt) return { restored: false };
  const member = await assertRoomMember(folder.roomId, session.user.id);
  const allowed = await canEditRoomDocumentFolder(prisma, {
    roomId: folder.roomId,
    folderId,
    userId: session.user.id,
    isManager: isRoomHubManagerRole(member.role),
  });
  if (!allowed) throw new Error("Anda tidak dapat memulihkan folder ini.");
  const parentId = folder.parent?.trashedAt ? null : folder.parentId;
  const duplicate = await prisma.roomDocumentFolder.findFirst({
    where: {
      roomId: folder.roomId,
      parentId,
      trashedAt: null,
      name: { equals: folder.name, mode: "insensitive" },
      NOT: { id: folder.id },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new Error("Sudah ada folder dengan nama yang sama di lokasi pemulihan.");
  }
  const roomFolders = await prisma.roomDocumentFolder.findMany({
    where: { roomId: folder.roomId },
    select: { id: true, name: true, parentId: true, sortOrder: true },
  });
  const subtreeIds = [
    folder.id,
    ...getDescendantFolderIds(roomFolders, folder.id),
  ];
  await prisma.$transaction(async (tx) => {
    await tx.roomDocumentFolder.update({
      where: { id: folder.id },
      data: { trashedAt: null, trashedById: null, parentId },
    });
    await tx.roomDocumentFolder.updateMany({
      where: { id: { in: subtreeIds }, NOT: { id: folder.id } },
      data: { trashedAt: null, trashedById: null },
    });
    await logRoomDocumentActivity(tx, {
      roomId: folder.roomId,
      actorId: session.user.id,
      action: "RESTORED",
      targetName: folder.name,
      folderId: folder.id,
    });
  });
  revalidateTasksAndRoomHub();
  return { restored: true };
}

export async function purgeRoomDocuments(documentIds: string[]) {
  const session = await requireTasksRoomHubSession();
  const ids = idsSchema.parse(documentIds);
  const docs = await prisma.roomDocument.findMany({
    where: { id: { in: ids }, trashedAt: { not: null } },
    select: {
      id: true,
      roomId: true,
      folderId: true,
      uploadedById: true,
      title: true,
      fileName: true,
      publicPath: true,
      thumbPath: true,
      versions: { select: { publicPath: true, thumbPath: true } },
    },
  });
  if (docs.length === 0) throw new Error("File di Sampah tidak ditemukan.");
  const roomId = docs[0]!.roomId;
  const member = await assertRoomMember(roomId, session.user.id);
  const isManager = isRoomHubManagerRole(member.role);
  for (const doc of docs) {
    const allowed = await canEditRoomDocument(prisma, {
      roomId,
      documentId: doc.id,
      folderId: doc.folderId,
      uploadedById: doc.uploadedById,
      userId: session.user.id,
      isManager,
    });
    if (!allowed) throw new Error("Anda tidak dapat menghapus permanen file ini.");
  }
  await prisma.$transaction(async (tx) => {
    for (const doc of docs) {
      await logRoomDocumentActivity(tx, {
        roomId,
        actorId: session.user.id,
        action: "PURGED",
        targetName: doc.title || doc.fileName,
        documentId: doc.id,
      });
    }
    await tx.roomDocument.deleteMany({ where: { id: { in: docs.map((doc) => doc.id) } } });
  });
  await removeStoredFiles(
    docs.flatMap((doc) => [
      doc.publicPath,
      doc.thumbPath,
      ...doc.versions.flatMap((version) => [version.publicPath, version.thumbPath]),
    ]),
  );
  revalidateTasksAndRoomHub();
  return { purged: docs.length };
}

export async function purgeRoomDocumentFolder(folderId: string) {
  const session = await requireTasksRoomHubSession();
  const folder = await prisma.roomDocumentFolder.findUniqueOrThrow({
    where: { id: folderId },
    select: { id: true, roomId: true, name: true, trashedAt: true },
  });
  if (!folder.trashedAt) throw new Error("Folder harus berada di Sampah.");
  const member = await assertRoomMember(folder.roomId, session.user.id);
  const allowed = await canEditRoomDocumentFolder(prisma, {
    roomId: folder.roomId,
    folderId,
    userId: session.user.id,
    isManager: isRoomHubManagerRole(member.role),
  });
  if (!allowed) throw new Error("Anda tidak dapat menghapus permanen folder ini.");
  const folders = await prisma.roomDocumentFolder.findMany({
    where: { roomId: folder.roomId },
    select: { id: true, name: true, parentId: true, sortOrder: true },
  });
  const descendants = getDescendantFolderIds(folders, folder.id);
  const folderIds = [folder.id, ...descendants];
  const docs = await prisma.roomDocument.findMany({
    where: { folderId: { in: folderIds } },
    select: {
      id: true,
      publicPath: true,
      thumbPath: true,
      versions: { select: { publicPath: true, thumbPath: true } },
    },
  });
  await prisma.$transaction(async (tx) => {
    await logRoomDocumentActivity(tx, {
      roomId: folder.roomId,
      actorId: session.user.id,
      action: "PURGED",
      targetName: folder.name,
      folderId: folder.id,
      detail: { documentCount: docs.length, folderCount: folderIds.length },
    });
    await tx.roomDocument.deleteMany({ where: { id: { in: docs.map((doc) => doc.id) } } });
    await tx.roomDocumentFolder.delete({ where: { id: folder.id } });
  });
  await removeStoredFiles(
    docs.flatMap((doc) => [
      doc.publicPath,
      doc.thumbPath,
      ...doc.versions.flatMap((version) => [version.publicPath, version.thumbPath]),
    ]),
  );
  revalidateTasksAndRoomHub();
  return { purgedFolders: folderIds.length, purgedDocuments: docs.length };
}

export async function toggleRoomDocumentFavorite(input: {
  kind: "document" | "folder";
  id: string;
}) {
  const session = await requireTasksRoomHubSession();
  if (input.kind === "document") {
    const doc = await prisma.roomDocument.findUniqueOrThrow({
      where: { id: input.id },
      select: { id: true, roomId: true, title: true, fileName: true },
    });
    await assertRoomMember(doc.roomId, session.user.id);
    const key = { documentId_userId: { documentId: doc.id, userId: session.user.id } };
    const existing = await prisma.roomDocumentFavorite.findUnique({ where: key });
    await prisma.$transaction(async (tx) => {
      if (existing) await tx.roomDocumentFavorite.delete({ where: key });
      else await tx.roomDocumentFavorite.create({ data: key.documentId_userId });
      await logRoomDocumentActivity(tx, {
        roomId: doc.roomId,
        actorId: session.user.id,
        action: existing ? "UNFAVORITED" : "FAVORITED",
        targetName: doc.title || doc.fileName,
        documentId: doc.id,
      });
    });
    revalidateTasksAndRoomHub();
    return { favorite: !existing };
  }

  const folder = await prisma.roomDocumentFolder.findUniqueOrThrow({
    where: { id: input.id },
    select: { id: true, roomId: true, name: true },
  });
  await assertRoomMember(folder.roomId, session.user.id);
  const key = { folderId_userId: { folderId: folder.id, userId: session.user.id } };
  const existing = await prisma.roomDocumentFolderFavorite.findUnique({ where: key });
  await prisma.$transaction(async (tx) => {
    if (existing) await tx.roomDocumentFolderFavorite.delete({ where: key });
    else await tx.roomDocumentFolderFavorite.create({ data: key.folderId_userId });
    await logRoomDocumentActivity(tx, {
      roomId: folder.roomId,
      actorId: session.user.id,
      action: existing ? "UNFAVORITED" : "FAVORITED",
      targetName: folder.name,
      folderId: folder.id,
    });
  });
  revalidateTasksAndRoomHub();
  return { favorite: !existing };
}

export async function listRoomDocumentActivity(roomId: string, take = 50) {
  const session = await requireTasksRoomHubSession();
  await assertRoomMember(roomId, session.user.id);
  return prisma.roomDocumentActivity.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(take, 1), 100),
    select: {
      id: true,
      action: true,
      targetName: true,
      detail: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
    },
  });
}

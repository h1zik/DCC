"use server";

import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember, isRoomHubManagerRole } from "@/lib/room-access";
import { canEditRoomDocument } from "@/lib/room-document-permissions";
import { logRoomDocumentActivity } from "@/lib/room-document-activity";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";

export async function listRoomDocumentVersions(documentId: string) {
  const session = await requireTasksRoomHubSession();
  const document = await prisma.roomDocument.findFirstOrThrow({
    where: {
      id: documentId,
      trashedAt: null,
      OR: [{ folderId: null }, { folder: { trashedAt: null } }],
    },
    select: { roomId: true },
  });
  await assertRoomMember(document.roomId, session.user.id);
  return prisma.roomDocumentVersion.findMany({
    where: { documentId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      fileName: true,
      mimeType: true,
      size: true,
      note: true,
      createdAt: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function restoreRoomDocumentVersion(input: {
  documentId: string;
  versionId: string;
}) {
  const session = await requireTasksRoomHubSession();
  const document = await prisma.roomDocument.findFirstOrThrow({
    where: {
      id: input.documentId,
      trashedAt: null,
      OR: [{ folderId: null }, { folder: { trashedAt: null } }],
    },
    select: {
      id: true,
      roomId: true,
      folderId: true,
      uploadedById: true,
      title: true,
      fileName: true,
      currentVersion: true,
    },
  });
  const member = await assertRoomMember(document.roomId, session.user.id);
  const allowed = await canEditRoomDocument(prisma, {
    roomId: document.roomId,
    documentId: document.id,
    folderId: document.folderId,
    uploadedById: document.uploadedById,
    userId: session.user.id,
    isManager: isRoomHubManagerRole(member.role),
  });
  if (!allowed) throw new Error("Anda tidak dapat memulihkan versi file ini.");
  const source = await prisma.roomDocumentVersion.findFirstOrThrow({
    where: { id: input.versionId, documentId: document.id },
  });
  const nextVersion = document.currentVersion + 1;
  await prisma.$transaction(async (tx) => {
    await tx.roomDocumentVersion.create({
      data: {
        documentId: document.id,
        version: nextVersion,
        fileName: source.fileName,
        mimeType: source.mimeType,
        size: source.size,
        publicPath: source.publicPath,
        thumbPath: source.thumbPath,
        uploadedById: session.user.id,
        note: `Dipulihkan dari versi ${source.version}`,
      },
    });
    await tx.roomDocument.update({
      where: { id: document.id },
      data: {
        fileName: source.fileName,
        mimeType: source.mimeType,
        size: source.size,
        publicPath: source.publicPath,
        thumbPath: source.thumbPath,
        currentVersion: nextVersion,
        searchText: null,
      },
    });
    await logRoomDocumentActivity(tx, {
      roomId: document.roomId,
      actorId: session.user.id,
      action: "VERSION_RESTORED",
      targetName: document.title || document.fileName,
      documentId: document.id,
      detail: { sourceVersion: source.version, newVersion: nextVersion },
    });
  });
  revalidateTasksAndRoomHub();
  return { version: nextVersion };
}

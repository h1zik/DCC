"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember, isRoomHubManagerRole } from "@/lib/room-access";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { logRoomDocumentActivity } from "@/lib/room-document-activity";
import {
  canEditRoomDocument,
  canEditRoomDocumentFolder,
} from "@/lib/room-document-permissions";

const targetSchema = z.object({
  kind: z.enum(["document", "folder"]),
  id: z.string().min(1),
});
const grantSchema = targetSchema.extend({
  recipientId: z.string().min(1),
  role: z.enum(["VIEWER", "EDITOR"]),
});

async function editableTarget(
  input: z.infer<typeof targetSchema>,
  userId: string,
) {
  if (input.kind === "document") {
    const doc = await prisma.roomDocument.findFirstOrThrow({
      where: {
        id: input.id,
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
      },
    });
    const member = await assertRoomMember(doc.roomId, userId);
    const allowed = await canEditRoomDocument(prisma, {
      roomId: doc.roomId,
      documentId: doc.id,
      folderId: doc.folderId,
      uploadedById: doc.uploadedById,
      userId,
      isManager: isRoomHubManagerRole(member.role),
    });
    if (!allowed) throw new Error("Anda tidak dapat mengatur akses file ini.");
    return { ...doc, kind: "document" as const, name: doc.title || doc.fileName };
  }
  const folder = await prisma.roomDocumentFolder.findFirstOrThrow({
    where: { id: input.id, trashedAt: null },
    select: { id: true, roomId: true, name: true },
  });
  const member = await assertRoomMember(folder.roomId, userId);
  const allowed = await canEditRoomDocumentFolder(prisma, {
    roomId: folder.roomId,
    folderId: folder.id,
    userId,
    isManager: isRoomHubManagerRole(member.role),
  });
  if (!allowed) throw new Error("Anda tidak dapat mengatur akses folder ini.");
  return { ...folder, kind: "folder" as const };
}

export async function getRoomDocumentShareSettings(
  input: z.infer<typeof targetSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = targetSchema.parse(input);
  const target = await editableTarget(data, session.user.id);
  const [members, grants, publicLinks] = await Promise.all([
    prisma.roomMember.findMany({
      where: { roomId: target.roomId },
      select: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    data.kind === "document"
      ? prisma.roomDocumentShare.findMany({
          where: { documentId: data.id, recipientId: { not: null } },
          select: {
            id: true,
            role: true,
            recipient: { select: { id: true, name: true, email: true } },
          },
        })
      : prisma.roomDocumentFolderShare.findMany({
          where: { folderId: data.id, recipientId: { not: null } },
          select: {
            id: true,
            role: true,
            recipient: { select: { id: true, name: true, email: true } },
          },
        }),
    data.kind === "document"
      ? prisma.roomDocumentShare.findMany({
          where: { documentId: data.id, token: { not: null } },
          select: { id: true, token: true, role: true, expiresAt: true },
        })
      : prisma.roomDocumentFolderShare.findMany({
          where: { folderId: data.id, token: { not: null } },
          select: { id: true, token: true, role: true, expiresAt: true },
        }),
  ]);
  return {
    members: members.map((member) => member.user),
    grants,
    publicLinks: publicLinks.map((link) => ({
      ...link,
      path: `/shared/documents/${link.token}`,
    })),
  };
}

export async function upsertRoomDocumentShare(
  input: z.infer<typeof grantSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = grantSchema.parse(input);
  const target = await editableTarget(data, session.user.id);
  if (data.recipientId === session.user.id) {
    throw new Error("Tidak perlu membagikan item kepada diri sendiri.");
  }
  const recipient = await prisma.roomMember.findFirst({
    where: { roomId: target.roomId, userId: data.recipientId },
    select: { userId: true },
  });
  if (!recipient) throw new Error("Penerima harus menjadi anggota ruangan.");
  await prisma.$transaction(async (tx) => {
    if (data.kind === "document") {
      await tx.roomDocumentShare.upsert({
        where: {
          documentId_recipientId: {
            documentId: data.id,
            recipientId: data.recipientId,
          },
        },
        update: { role: data.role },
        create: {
          roomId: target.roomId,
          documentId: data.id,
          recipientId: data.recipientId,
          role: data.role,
          createdById: session.user.id,
        },
      });
    } else {
      await tx.roomDocumentFolderShare.upsert({
        where: {
          folderId_recipientId: {
            folderId: data.id,
            recipientId: data.recipientId,
          },
        },
        update: { role: data.role },
        create: {
          roomId: target.roomId,
          folderId: data.id,
          recipientId: data.recipientId,
          role: data.role,
          createdById: session.user.id,
        },
      });
    }
    await logRoomDocumentActivity(tx, {
      roomId: target.roomId,
      actorId: session.user.id,
      action: "SHARED",
      targetName: target.name,
      documentId: data.kind === "document" ? data.id : undefined,
      folderId: data.kind === "folder" ? data.id : undefined,
      detail: { recipientId: data.recipientId, role: data.role },
    });
  });
  revalidateTasksAndRoomHub();
}

export async function createPublicRoomDocumentShareLink(
  input: z.infer<typeof targetSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = targetSchema.parse(input);
  const target = await editableTarget(data, session.user.id);
  const token = randomBytes(24).toString("base64url");
  await prisma.$transaction(async (tx) => {
    if (data.kind === "document") {
      await tx.roomDocumentShare.create({
        data: {
          roomId: target.roomId,
          documentId: data.id,
          token,
          role: "VIEWER",
          createdById: session.user.id,
        },
      });
    } else {
      await tx.roomDocumentFolderShare.create({
        data: {
          roomId: target.roomId,
          folderId: data.id,
          token,
          role: "VIEWER",
          createdById: session.user.id,
        },
      });
    }
    await logRoomDocumentActivity(tx, {
      roomId: target.roomId,
      actorId: session.user.id,
      action: "SHARED",
      targetName: target.name,
      documentId: data.kind === "document" ? data.id : undefined,
      folderId: data.kind === "folder" ? data.id : undefined,
      detail: { publicLink: true },
    });
  });
  revalidateTasksAndRoomHub();
  return { path: `/shared/documents/${token}` };
}

export async function revokeRoomDocumentShare(input: {
  kind: "document" | "folder";
  shareId: string;
}) {
  const session = await requireTasksRoomHubSession();
  const data = z
    .object({ kind: z.enum(["document", "folder"]), shareId: z.string().min(1) })
    .parse(input);
  if (data.kind === "document") {
    const share = await prisma.roomDocumentShare.findUniqueOrThrow({
      where: { id: data.shareId },
      select: { id: true, documentId: true, recipientId: true, token: true },
    });
    const target = await editableTarget(
      { kind: "document", id: share.documentId },
      session.user.id,
    );
    await prisma.$transaction(async (tx) => {
      await tx.roomDocumentShare.delete({ where: { id: share.id } });
      await logRoomDocumentActivity(tx, {
        roomId: target.roomId,
        actorId: session.user.id,
        action: "SHARE_REVOKED",
        targetName: target.name,
        documentId: target.id,
        detail: { recipientId: share.recipientId, publicLink: Boolean(share.token) },
      });
    });
  } else {
    const share = await prisma.roomDocumentFolderShare.findUniqueOrThrow({
      where: { id: data.shareId },
      select: { id: true, folderId: true, recipientId: true, token: true },
    });
    const target = await editableTarget(
      { kind: "folder", id: share.folderId },
      session.user.id,
    );
    await prisma.$transaction(async (tx) => {
      await tx.roomDocumentFolderShare.delete({ where: { id: share.id } });
      await logRoomDocumentActivity(tx, {
        roomId: target.roomId,
        actorId: session.user.id,
        action: "SHARE_REVOKED",
        targetName: target.name,
        folderId: target.id,
        detail: { recipientId: share.recipientId, publicLink: Boolean(share.token) },
      });
    });
  }
  revalidateTasksAndRoomHub();
}

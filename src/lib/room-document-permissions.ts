import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

type PermissionClient = PrismaClient | Prisma.TransactionClient;

function activeShareWhere(now: Date) {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

async function folderAncestorIds(
  db: PermissionClient,
  roomId: string,
  folderId: string,
): Promise<string[]> {
  const folders = await db.roomDocumentFolder.findMany({
    where: { roomId },
    select: { id: true, parentId: true },
  });
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const ids: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(folderId);
  while (current && !seen.has(current.id)) {
    ids.push(current.id);
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return ids;
}

export async function canEditRoomDocument(
  db: PermissionClient,
  input: {
    roomId: string;
    documentId: string;
    folderId: string | null;
    uploadedById: string;
    userId: string;
    isManager: boolean;
  },
): Promise<boolean> {
  if (input.isManager || input.uploadedById === input.userId) return true;
  const now = new Date();
  const direct = await db.roomDocumentShare.findFirst({
    where: {
      documentId: input.documentId,
      recipientId: input.userId,
      role: "EDITOR",
      ...activeShareWhere(now),
    },
    select: { id: true },
  });
  if (direct) return true;
  if (!input.folderId) return false;
  const folderIds = await folderAncestorIds(db, input.roomId, input.folderId);
  if (folderIds.length === 0) return false;
  const inherited = await db.roomDocumentFolderShare.findFirst({
    where: {
      folderId: { in: folderIds },
      recipientId: input.userId,
      role: "EDITOR",
      ...activeShareWhere(now),
    },
    select: { id: true },
  });
  return inherited != null;
}

export async function canEditRoomDocumentFolder(
  db: PermissionClient,
  input: {
    roomId: string;
    folderId: string;
    userId: string;
    isManager: boolean;
  },
): Promise<boolean> {
  if (input.isManager) return true;
  const folderIds = await folderAncestorIds(db, input.roomId, input.folderId);
  if (folderIds.length === 0) return false;
  const share = await db.roomDocumentFolderShare.findFirst({
    where: {
      folderId: { in: folderIds },
      recipientId: input.userId,
      role: "EDITOR",
      ...activeShareWhere(new Date()),
    },
    select: { id: true },
  });
  return share != null;
}

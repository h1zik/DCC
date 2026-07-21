import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

type ActivityClient = PrismaClient | Prisma.TransactionClient;

export type RoomDocumentActivityAction =
  | "CREATED"
  | "UPLOADED"
  | "RENAMED"
  | "MOVED"
  | "TRASHED"
  | "RESTORED"
  | "PURGED"
  | "VERSION_ADDED"
  | "VERSION_RESTORED"
  | "FAVORITED"
  | "UNFAVORITED"
  | "SHARED"
  | "SHARE_REVOKED";

export async function logRoomDocumentActivity(
  db: ActivityClient,
  input: {
    roomId: string;
    actorId: string;
    action: RoomDocumentActivityAction;
    targetName: string;
    documentId?: string | null;
    folderId?: string | null;
    detail?: Prisma.InputJsonValue;
  },
) {
  await db.roomDocumentActivity.create({
    data: {
      roomId: input.roomId,
      actorId: input.actorId,
      action: input.action,
      targetName: input.targetName.slice(0, 240),
      documentId: input.documentId ?? undefined,
      folderId: input.folderId ?? undefined,
      detail: input.detail,
    },
  });
}

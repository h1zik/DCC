import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DirectChatAttachmentView = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  publicPath: string;
};

export type DirectChatMessageView = {
  id: string;
  body: string;
  gifUrl: string | null;
  replyToId: string | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  author: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  attachments: DirectChatAttachmentView[];
  replyTo: null | {
    id: string;
    body: string;
    gifUrl: string | null;
    deletedAt: string | null;
    author: { name: string | null; email: string };
    attachmentCount: number;
  };
};

export const directChatMessageInclude = {
  author: { select: { id: true, name: true, email: true, image: true } },
  attachments: {
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      publicPath: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
  replyTo: {
    select: {
      id: true,
      body: true,
      gifUrl: true,
      deletedAt: true,
      author: { select: { name: true, email: true } },
      _count: { select: { attachments: true } },
    },
  },
} satisfies Prisma.DirectMessageInclude;

export type DirectChatMessageRow = Prisma.DirectMessageGetPayload<{
  include: typeof directChatMessageInclude;
}>;

export function mapDirectMessageToView(
  m: DirectChatMessageRow,
): DirectChatMessageView {
  return {
    id: m.id,
    body: m.deletedAt ? "" : m.body,
    gifUrl: m.deletedAt ? null : m.gifUrl,
    replyToId: m.replyToId,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    editedAt: m.editedAt?.toISOString() ?? null,
    deletedAt: m.deletedAt?.toISOString() ?? null,
    author: m.author,
    attachments: m.deletedAt
      ? []
      : m.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          publicPath: a.publicPath,
        })),
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          body: m.replyTo.deletedAt ? "" : m.replyTo.body,
          gifUrl: m.replyTo.deletedAt ? null : m.replyTo.gifUrl,
          deletedAt: m.replyTo.deletedAt?.toISOString() ?? null,
          author: m.replyTo.author,
          attachmentCount: m.replyTo._count.attachments,
        }
      : null,
  };
}

export const DIRECT_CHAT_INITIAL_MESSAGE_LIMIT = 200;
export const DIRECT_CHAT_DELTA_MESSAGE_LIMIT = 500;

function messageActivityWhere(conversationId: string, since: Date) {
  return {
    conversationId,
    OR: [{ createdAt: { gt: since } }, { updatedAt: { gt: since } }],
  };
}

export async function loadDirectChatMessages(
  conversationId: string,
  limit: number = DIRECT_CHAT_INITIAL_MESSAGE_LIMIT,
): Promise<DirectChatMessageView[]> {
  const take = Math.max(1, Math.min(limit, DIRECT_CHAT_INITIAL_MESSAGE_LIMIT));
  const rows = await prisma.directMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take,
    include: directChatMessageInclude,
  });
  return rows.map(mapDirectMessageToView).reverse();
}

export async function loadDirectChatMessagesSince(
  conversationId: string,
  since: Date,
  limit: number = DIRECT_CHAT_DELTA_MESSAGE_LIMIT,
): Promise<DirectChatMessageView[]> {
  const take = Math.max(1, Math.min(limit, DIRECT_CHAT_DELTA_MESSAGE_LIMIT));
  const rows = await prisma.directMessage.findMany({
    where: messageActivityWhere(conversationId, since),
    orderBy: { createdAt: "asc" },
    take,
    include: directChatMessageInclude,
  });
  return rows.map(mapDirectMessageToView);
}

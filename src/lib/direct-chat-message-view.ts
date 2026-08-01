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

/**
 * Ukuran satu halaman riwayat lama (mode `?before=`). Riwayat penuh tetap bisa
 * dijangkau — klien memanggil berulang selama `hasMore` masih true.
 */
export const DIRECT_CHAT_OLDER_PAGE_SIZE = 100;

/**
 * Urutan kanonik percakapan. `id` dipakai sebagai pemecah seri agar cursor
 * `?before=` tidak melewati pesan yang punya `createdAt` identik.
 */
const DIRECT_CHAT_DESC_ORDER = [
  { createdAt: "desc" as const },
  { id: "desc" as const },
];

export type DirectChatMessagePage = {
  messages: DirectChatMessageView[];
  /** Masih ada pesan yang lebih lama dari halaman ini. */
  hasMore: boolean;
};

function messageActivityWhere(conversationId: string, since: Date) {
  return {
    conversationId,
    OR: [{ createdAt: { gt: since } }, { updatedAt: { gt: since } }],
  };
}

export async function loadDirectChatMessages(
  conversationId: string,
  limit: number = DIRECT_CHAT_INITIAL_MESSAGE_LIMIT,
): Promise<DirectChatMessagePage> {
  const take = Math.max(1, Math.min(limit, DIRECT_CHAT_INITIAL_MESSAGE_LIMIT));
  const rows = await prisma.directMessage.findMany({
    where: { conversationId },
    orderBy: DIRECT_CHAT_DESC_ORDER,
    // Satu baris ekstra hanya untuk mendeteksi adanya riwayat lebih lama.
    take: take + 1,
    include: directChatMessageInclude,
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return { messages: page.map(mapDirectMessageToView).reverse(), hasMore };
}

/**
 * Halaman riwayat sebelum `beforeMessageId` (eksklusif), ascending.
 * Dipakai tombol "Muat pesan lama" agar percakapan bisa ditelusuri sampai
 * pesan pertama tanpa membebani pemuatan awal.
 */
export async function loadDirectChatMessagesOlder(
  conversationId: string,
  beforeMessageId: string,
  limit: number = DIRECT_CHAT_OLDER_PAGE_SIZE,
): Promise<DirectChatMessagePage> {
  const take = Math.max(1, Math.min(limit, DIRECT_CHAT_OLDER_PAGE_SIZE));

  // Cursor wajib milik percakapan ini — jangan sampai id dari percakapan lain
  // menggeser jendela paginasi.
  const anchor = await prisma.directMessage.findFirst({
    where: { id: beforeMessageId, conversationId },
    select: { id: true },
  });
  if (!anchor) return { messages: [], hasMore: false };

  const rows = await prisma.directMessage.findMany({
    where: { conversationId },
    orderBy: DIRECT_CHAT_DESC_ORDER,
    cursor: { id: beforeMessageId },
    skip: 1,
    take: take + 1,
    include: directChatMessageInclude,
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return { messages: page.map(mapDirectMessageToView).reverse(), hasMore };
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

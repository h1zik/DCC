import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { splitLinkifiedText } from "@/lib/linkify-chat-text";
import {
  directChatMessageInclude,
  mapDirectMessageToView,
  type DirectChatMessagePage,
} from "@/lib/direct-chat-message-view";

/** Ukuran satu halaman hasil pencarian / daftar berkas. */
export const DIRECT_CHAT_SEARCH_PAGE_SIZE = 30;
export const DIRECT_CHAT_SHARED_PAGE_SIZE = 36;
export const DIRECT_CHAT_SEARCH_MIN_QUERY = 2;

/** Jumlah pesan sebelum target yang ikut dimuat saat melompat, sebagai konteks. */
const JUMP_CONTEXT_BEFORE = 15;
/** Batas aman rentang lompatan — di atas ini riwayat dianggap terlalu jauh. */
const JUMP_MAX_RANGE = 2000;

const DESC_ORDER = [{ createdAt: "desc" as const }, { id: "desc" as const }];

export type DirectChatSharedKind = "media" | "files" | "links";

export type DirectChatSearchHit = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string };
  attachmentNames: string[];
  hasGif: boolean;
};

export type DirectChatSearchPage = {
  hits: DirectChatSearchHit[];
  nextCursor: string | null;
};

export type DirectChatSharedAttachment = {
  type: "attachment";
  id: string;
  messageId: string;
  authorId: string;
  createdAt: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  publicPath: string;
};

export type DirectChatSharedLink = {
  type: "link";
  id: string;
  messageId: string;
  authorId: string;
  createdAt: string;
  href: string;
  /** Potongan isi pesan tempat tautan muncul — membantu mengenali konteksnya. */
  context: string;
};

export type DirectChatSharedItem =
  | DirectChatSharedAttachment
  | DirectChatSharedLink;

export type DirectChatSharedPage = {
  items: DirectChatSharedItem[];
  nextCursor: string | null;
};

export function parseDirectChatSharedKind(
  raw: string | null,
): DirectChatSharedKind | null {
  return raw === "media" || raw === "files" || raw === "links" ? raw : null;
}

/** Cari isi pesan + nama file lampiran di seluruh riwayat percakapan. */
export async function searchDirectChatMessages(
  conversationId: string,
  query: string,
  cursor?: string | null,
): Promise<DirectChatSearchPage> {
  const q = query.trim();
  if (q.length < DIRECT_CHAT_SEARCH_MIN_QUERY) {
    return { hits: [], nextCursor: null };
  }

  const validCursor = cursor
    ? await prisma.directMessage.findFirst({
        where: { id: cursor, conversationId },
        select: { id: true },
      })
    : null;

  const rows = await prisma.directMessage.findMany({
    where: {
      conversationId,
      deletedAt: null,
      OR: [
        { body: { contains: q, mode: "insensitive" } },
        {
          attachments: {
            some: { fileName: { contains: q, mode: "insensitive" } },
          },
        },
      ],
    },
    orderBy: DESC_ORDER,
    ...(validCursor ? { cursor: { id: validCursor.id }, skip: 1 } : {}),
    take: DIRECT_CHAT_SEARCH_PAGE_SIZE + 1,
    select: {
      id: true,
      body: true,
      gifUrl: true,
      createdAt: true,
      author: { select: { id: true, name: true, email: true } },
      attachments: {
        select: { fileName: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const hasMore = rows.length > DIRECT_CHAT_SEARCH_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, DIRECT_CHAT_SEARCH_PAGE_SIZE) : rows;
  return {
    hits: page.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      author: m.author,
      attachmentNames: m.attachments.map((a) => a.fileName),
      hasGif: Boolean(m.gifUrl),
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

const MEDIA_MIME_FILTER: Prisma.DirectMessageAttachmentWhereInput[] = [
  { mimeType: { startsWith: "image/", mode: "insensitive" } },
  { mimeType: { startsWith: "video/", mode: "insensitive" } },
];

async function loadSharedAttachments(
  conversationId: string,
  kind: "media" | "files",
  cursor?: string | null,
): Promise<DirectChatSharedPage> {
  const scope: Prisma.DirectMessageAttachmentWhereInput = {
    message: { conversationId, deletedAt: null },
  };
  const validCursor = cursor
    ? await prisma.directMessageAttachment.findFirst({
        where: { id: cursor, ...scope },
        select: { id: true },
      })
    : null;

  const rows = await prisma.directMessageAttachment.findMany({
    where: {
      ...scope,
      ...(kind === "media" ? { OR: MEDIA_MIME_FILTER } : { NOT: MEDIA_MIME_FILTER }),
    },
    orderBy: DESC_ORDER,
    ...(validCursor ? { cursor: { id: validCursor.id }, skip: 1 } : {}),
    take: DIRECT_CHAT_SHARED_PAGE_SIZE + 1,
    select: {
      id: true,
      messageId: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      publicPath: true,
      createdAt: true,
      message: { select: { authorId: true } },
    },
  });

  const hasMore = rows.length > DIRECT_CHAT_SHARED_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, DIRECT_CHAT_SHARED_PAGE_SIZE) : rows;
  return {
    items: page.map((a) => ({
      type: "attachment" as const,
      id: a.id,
      messageId: a.messageId,
      authorId: a.message.authorId,
      createdAt: a.createdAt.toISOString(),
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      publicPath: a.publicPath,
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

function linkContext(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 140 ? `${flat.slice(0, 140)}…` : flat;
}

async function loadSharedLinks(
  conversationId: string,
  cursor?: string | null,
): Promise<DirectChatSharedPage> {
  const validCursor = cursor
    ? await prisma.directMessage.findFirst({
        where: { id: cursor, conversationId },
        select: { id: true },
      })
    : null;

  const rows = await prisma.directMessage.findMany({
    where: {
      conversationId,
      deletedAt: null,
      OR: [
        { body: { contains: "http://", mode: "insensitive" } },
        { body: { contains: "https://", mode: "insensitive" } },
        { body: { contains: "www.", mode: "insensitive" } },
      ],
    },
    orderBy: DESC_ORDER,
    ...(validCursor ? { cursor: { id: validCursor.id }, skip: 1 } : {}),
    take: DIRECT_CHAT_SHARED_PAGE_SIZE + 1,
    select: { id: true, body: true, authorId: true, createdAt: true },
  });

  const hasMore = rows.length > DIRECT_CHAT_SHARED_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, DIRECT_CHAT_SHARED_PAGE_SIZE) : rows;

  const items: DirectChatSharedLink[] = [];
  for (const m of page) {
    const seen = new Set<string>();
    for (const segment of splitLinkifiedText(m.body)) {
      if (segment.type !== "link" || seen.has(segment.href)) continue;
      seen.add(segment.href);
      items.push({
        type: "link",
        id: `${m.id}:${seen.size}`,
        messageId: m.id,
        authorId: m.authorId,
        createdAt: m.createdAt.toISOString(),
        href: segment.href,
        context: linkContext(m.body),
      });
    }
  }

  return { items, nextCursor: hasMore ? page[page.length - 1]!.id : null };
}

/** Media, file, atau tautan yang pernah dikirim di percakapan — terbaru dulu. */
export async function loadDirectChatShared(
  conversationId: string,
  kind: DirectChatSharedKind,
  cursor?: string | null,
): Promise<DirectChatSharedPage> {
  return kind === "links"
    ? loadSharedLinks(conversationId, cursor)
    : loadSharedAttachments(conversationId, kind, cursor);
}

/**
 * Rentang pesan dari `targetMessageId` (plus sedikit konteks sebelumnya) sampai
 * pesan tertua yang sudah dimiliki klien (`beforeMessageId`). Dipakai untuk
 * melompat ke pesan lama tanpa memutus kesinambungan riwayat di klien — cursor
 * "Muat pesan lama" tetap valid sesudahnya.
 *
 * Mengembalikan `null` bila target tidak ada atau rentangnya terlalu jauh.
 */
export async function loadDirectChatMessagesUntil(
  conversationId: string,
  targetMessageId: string,
  beforeMessageId: string | null,
): Promise<DirectChatMessagePage | null> {
  const [target, anchor] = await Promise.all([
    prisma.directMessage.findFirst({
      where: { id: targetMessageId, conversationId },
      select: { createdAt: true },
    }),
    beforeMessageId
      ? prisma.directMessage.findFirst({
          where: { id: beforeMessageId, conversationId },
          select: { createdAt: true },
        })
      : null,
  ]);
  if (!target) return null;

  const [range, context] = await Promise.all([
    prisma.directMessage.findMany({
      where: {
        conversationId,
        createdAt: {
          gte: target.createdAt,
          ...(anchor ? { lte: anchor.createdAt } : {}),
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: JUMP_MAX_RANGE + 1,
      include: directChatMessageInclude,
    }),
    prisma.directMessage.findMany({
      where: { conversationId, createdAt: { lt: target.createdAt } },
      orderBy: DESC_ORDER,
      take: JUMP_CONTEXT_BEFORE + 1,
      include: directChatMessageInclude,
    }),
  ]);
  if (range.length > JUMP_MAX_RANGE) return null;

  const hasMore = context.length > JUMP_CONTEXT_BEFORE;
  const before = (hasMore ? context.slice(0, JUMP_CONTEXT_BEFORE) : context).reverse();
  return {
    messages: [...before, ...range].map(mapDirectMessageToView),
    hasMore,
  };
}

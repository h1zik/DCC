import { prisma } from "@/lib/prisma";
import { directChatMessageInclude, mapDirectMessageToView } from "@/lib/direct-chat-message-view";

export type DirectInboxItem = {
  conversationId: string;
  otherUser: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    lastSeenAt: string | null;
  };
  lastMessage: {
    body: string;
    gifUrl: string | null;
    authorId: string;
    createdAt: string;
    deletedAt: string | null;
    attachmentCount: number;
  } | null;
  unreadCount: number;
  updatedAt: string;
};

export async function loadDirectChatInbox(
  userId: string,
): Promise<DirectInboxItem[]> {
  const memberships = await prisma.directConversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                  lastSeenAt: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              ...directChatMessageInclude,
            },
          },
        },
      },
    },
  });

  const items: DirectInboxItem[] = [];

  for (const m of memberships) {
    const conv = m.conversation;
    const other = conv.members.find((x) => x.userId !== userId)?.user;
    if (!other) continue;

    const lastRow = conv.messages[0];
    const lastRead = m.lastReadAt;

    let unreadCount = 0;
    if (lastRow && lastRow.authorId !== userId) {
      if (!lastRead || lastRow.createdAt > lastRead) {
        unreadCount = await prisma.directMessage.count({
          where: {
            conversationId: conv.id,
            authorId: { not: userId },
            deletedAt: null,
            ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
          },
        });
      }
    }

    items.push({
      conversationId: conv.id,
      otherUser: {
        id: other.id,
        name: other.name,
        email: other.email,
        image: other.image,
        lastSeenAt: other.lastSeenAt?.toISOString() ?? null,
      },
      lastMessage: lastRow
        ? {
            body: lastRow.body,
            gifUrl: lastRow.gifUrl,
            authorId: lastRow.authorId,
            createdAt: lastRow.createdAt.toISOString(),
            deletedAt: lastRow.deletedAt?.toISOString() ?? null,
            attachmentCount: lastRow.attachments.length,
          }
        : null,
      unreadCount,
      updatedAt: (conv.lastMessageAt ?? conv.createdAt).toISOString(),
    });
  }

  items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  return items;
}

export async function loadDirectChatTotalUnread(userId: string): Promise<number> {
  const memberships = await prisma.directConversationMember.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  });
  let total = 0;
  for (const m of memberships) {
    total += await prisma.directMessage.count({
      where: {
        conversationId: m.conversationId,
        authorId: { not: userId },
        deletedAt: null,
        ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
      },
    });
  }
  return total;
}

export function previewText(
  msg: DirectInboxItem["lastMessage"],
  authorId: string,
  currentUserId: string,
): string {
  if (!msg) return "Mulai percakapan";
  const prefix = msg.authorId === currentUserId ? "Anda: " : "";
  if (msg.deletedAt) return `${prefix}Pesan dihapus`;
  if (msg.gifUrl && msg.body.trim()) {
    const t = msg.body.trim();
    return `${prefix}${t.length > 48 ? `${t.slice(0, 48)}…` : t} · GIF`;
  }
  if (msg.gifUrl) return `${prefix}GIF`;
  if (msg.attachmentCount > 0 && !msg.body.trim()) {
    return msg.attachmentCount === 1
      ? `${prefix}Lampiran`
      : `${prefix}${msg.attachmentCount} lampiran`;
  }
  const t = msg.body.trim();
  if (!t && msg.attachmentCount > 0) {
    return msg.attachmentCount === 1
      ? `${prefix}Lampiran`
      : `${prefix}${msg.attachmentCount} lampiran`;
  }
  if (!t) return `${prefix}(pesan)`;
  const suffix =
    msg.attachmentCount > 0 ? ` · ${msg.attachmentCount} lampiran` : "";
  const cut = t.length > 48 ? `${t.slice(0, 48)}…` : t;
  return `${prefix}${cut}${suffix}`;
}

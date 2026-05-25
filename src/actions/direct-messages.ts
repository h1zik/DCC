"use server";

import { unlink } from "node:fs/promises";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSafeGifUrl } from "@/lib/room-chat-gif";
import { getAppBranding } from "@/lib/app-branding";
import { sendWebPushMessage } from "@/lib/web-push";
import {
  assertDirectConversationMember,
  listDirectChatEligibleUsers,
  requireDirectChatSession,
} from "@/lib/direct-chat-access";
import {
  DIRECT_CHAT_MAX_FILES_PER_MESSAGE,
  saveDirectChatAttachmentFile,
} from "@/lib/direct-chat-attachments";
import { absolutePathFromStoredPublicPath } from "@/lib/upload-storage";
import {
  directChatMessageInclude,
  mapDirectMessageToView,
  type DirectChatMessageView,
} from "@/lib/direct-chat-message-view";
import { loadDirectChatInbox } from "@/lib/direct-chat-inbox";

const sendSchema = z.object({
  conversationId: z.string().min(1),
  body: z.string().max(4000),
  gifUrl: z.string().max(2048).optional(),
  replyToId: z.string().min(1).optional(),
});

const editSchema = z.object({
  messageId: z.string().min(1),
  body: z.string().max(4000),
});

async function findExistingConversation(userA: string, userB: string) {
  const candidates = await prisma.directConversation.findMany({
    where: {
      AND: [
        { members: { some: { userId: userA } } },
        { members: { some: { userId: userB } } },
      ],
    },
    include: { _count: { select: { members: true } } },
  });
  return candidates.find((c) => c._count.members === 2) ?? null;
}

async function assertReplyInConversation(
  conversationId: string,
  replyToId: string | null,
) {
  if (!replyToId) return;
  const parent = await prisma.directMessage.findFirst({
    where: { id: replyToId, conversationId },
    select: { id: true },
  });
  if (!parent) {
    throw new Error("Pesan yang dibalas tidak ditemukan.");
  }
}

async function notifyDirectMessageViaPush(params: {
  conversationId: string;
  recipientUserId: string;
  authorName: string;
  body: string;
  hasGif: boolean;
  hasAttachments: boolean;
}) {
  const branding = await getAppBranding();
  const pushIconPath = branding.pushIconPath ?? "/next.svg";
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: params.recipientUserId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subscriptions.length === 0) return;

  const preview = params.body.trim();
  const snippet = preview
    ? preview.length > 90
      ? `${preview.slice(0, 90)}…`
      : preview
    : params.hasGif
      ? "Mengirim GIF"
      : params.hasAttachments
        ? "Mengirim lampiran"
        : "Pesan baru";
  const sender = params.authorName.trim() || "Rekan tim";
  const invalidIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      const sent = await sendWebPushMessage({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        payload: {
          title: `Pesan dari ${sender}`,
          body: snippet,
          url: `/messages?c=${params.conversationId}`,
          icon: pushIconPath,
          tag: "dcc-direct-message",
        },
      });
      if (!sent.ok && sent.reason === "gone") invalidIds.push(sub.id);
    }),
  );

  if (invalidIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: invalidIds } },
    });
  }
}

async function notifyConversationPeers(params: {
  conversationId: string;
  authorId: string;
  authorName: string;
  body: string;
  hasGif: boolean;
  hasAttachments: boolean;
}) {
  const members = await prisma.directConversationMember.findMany({
    where: { conversationId: params.conversationId },
    select: { userId: true },
  });
  await Promise.all(
    members
      .filter((m) => m.userId !== params.authorId)
      .map((m) =>
        notifyDirectMessageViaPush({
          conversationId: params.conversationId,
          recipientUserId: m.userId,
          authorName: params.authorName,
          body: params.body,
          hasGif: params.hasGif,
          hasAttachments: params.hasAttachments,
        }),
      ),
  );
}

export async function getOrCreateDirectConversation(otherUserId: string) {
  const session = await requireDirectChatSession();
  const selfId = session.user.id;
  if (otherUserId === selfId) {
    throw new Error("Tidak dapat mengobrol dengan diri sendiri.");
  }

  const eligible = await listDirectChatEligibleUsers(selfId);
  if (!eligible.some((u) => u.id === otherUserId)) {
    throw new Error("Pengguna tidak dapat dihubungi lewat pesan pribadi.");
  }

  const existing = await findExistingConversation(selfId, otherUserId);
  if (existing) return { conversationId: existing.id };

  const created = await prisma.$transaction(async (tx) => {
    const conv = await tx.directConversation.create({ data: {} });
    await tx.directConversationMember.createMany({
      data: [
        { conversationId: conv.id, userId: selfId },
        { conversationId: conv.id, userId: otherUserId },
      ],
    });
    return conv;
  });

  return { conversationId: created.id };
}

export async function sendDirectMessage(
  input: z.infer<typeof sendSchema>,
): Promise<DirectChatMessageView> {
  const session = await requireDirectChatSession();
  const data = sendSchema.parse(input);
  const body = data.body.trim();
  const gifRaw = (data.gifUrl ?? "").trim();
  const gifUrl = gifRaw ? assertSafeGifUrl(gifRaw) : null;
  const replyToId = (data.replyToId ?? "").trim() || null;

  if (!body && !gifUrl) {
    throw new Error("Tulis pesan atau pilih GIF.");
  }

  await assertDirectConversationMember(data.conversationId, session.user.id);
  await assertReplyInConversation(data.conversationId, replyToId);

  const created = await prisma.directMessage.create({
    data: {
      conversationId: data.conversationId,
      authorId: session.user.id,
      body,
      gifUrl,
      replyToId,
    },
    include: directChatMessageInclude,
  });

  await prisma.directConversation.update({
    where: { id: data.conversationId },
    data: { lastMessageAt: created.createdAt },
  });

  const authorName =
    session.user.name?.trim() || session.user.email || "Pengguna";

  await notifyConversationPeers({
    conversationId: data.conversationId,
    authorId: session.user.id,
    authorName,
    body,
    hasGif: Boolean(gifUrl),
    hasAttachments: false,
  });

  return mapDirectMessageToView(created);
}

export async function sendDirectMessageForm(
  formData: FormData,
): Promise<DirectChatMessageView> {
  const session = await requireDirectChatSession();
  const conversationId = String(formData.get("conversationId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const gifRaw = String(formData.get("gifUrl") ?? "").trim();
  const replyToIdRaw = String(formData.get("replyToId") ?? "").trim();
  const gifUrl = gifRaw ? assertSafeGifUrl(gifRaw) : null;
  const replyToId = replyToIdRaw || null;
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File);

  if (!conversationId) throw new Error("Percakapan tidak valid.");
  if (files.length > DIRECT_CHAT_MAX_FILES_PER_MESSAGE) {
    throw new Error(`Maksimal ${DIRECT_CHAT_MAX_FILES_PER_MESSAGE} file per pesan.`);
  }
  if (!body && !gifUrl && files.length === 0) {
    throw new Error("Tulis pesan, pilih GIF, atau lampirkan file.");
  }

  await assertDirectConversationMember(conversationId, session.user.id);
  await assertReplyInConversation(conversationId, replyToId);

  const created = await prisma.directMessage.create({
    data: {
      conversationId,
      authorId: session.user.id,
      body,
      gifUrl,
      replyToId,
    },
    include: directChatMessageInclude,
  });

  for (const file of files) {
    const saved = await saveDirectChatAttachmentFile({
      conversationId,
      messageId: created.id,
      file,
    });
    await prisma.directMessageAttachment.create({
      data: {
        messageId: created.id,
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        publicPath: saved.publicPath,
      },
    });
  }

  const full = await prisma.directMessage.findUniqueOrThrow({
    where: { id: created.id },
    include: directChatMessageInclude,
  });

  await prisma.directConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: full.createdAt },
  });

  const authorName =
    session.user.name?.trim() || session.user.email || "Pengguna";

  await notifyConversationPeers({
    conversationId,
    authorId: session.user.id,
    authorName,
    body,
    hasGif: Boolean(gifUrl),
    hasAttachments: files.length > 0,
  });

  return mapDirectMessageToView(full);
}

export async function editDirectMessage(
  input: z.infer<typeof editSchema>,
): Promise<DirectChatMessageView> {
  const session = await requireDirectChatSession();
  const data = editSchema.parse(input);
  const body = data.body.trim();
  if (!body) throw new Error("Pesan tidak boleh kosong.");

  const existing = await prisma.directMessage.findUniqueOrThrow({
    where: { id: data.messageId },
    select: {
      authorId: true,
      conversationId: true,
      deletedAt: true,
      gifUrl: true,
      attachments: { select: { id: true }, take: 1 },
    },
  });

  if (existing.deletedAt) throw new Error("Pesan sudah dihapus.");
  if (existing.authorId !== session.user.id) {
    throw new Error("Hanya penulis yang dapat mengedit pesan.");
  }
  if (existing.gifUrl && !body) {
    throw new Error("Tambahkan teks pada pesan GIF.");
  }
  if (!body && existing.attachments.length === 0 && !existing.gifUrl) {
    throw new Error("Pesan tidak boleh kosong.");
  }

  await assertDirectConversationMember(existing.conversationId, session.user.id);

  const updated = await prisma.directMessage.update({
    where: { id: data.messageId },
    data: { body, editedAt: new Date() },
    include: directChatMessageInclude,
  });

  return mapDirectMessageToView(updated);
}

export async function deleteDirectMessage(messageId: string) {
  const session = await requireDirectChatSession();
  const existing = await prisma.directMessage.findUniqueOrThrow({
    where: { id: messageId },
    include: {
      attachments: { select: { publicPath: true } },
    },
  });

  if (existing.authorId !== session.user.id) {
    throw new Error("Hanya penulis yang dapat menghapus pesan.");
  }
  if (existing.deletedAt) return;

  await assertDirectConversationMember(existing.conversationId, session.user.id);

  for (const att of existing.attachments) {
    const abs = absolutePathFromStoredPublicPath(att.publicPath);
    if (abs) {
      try {
        await unlink(abs);
      } catch {
        /* file mungkin sudah hilang */
      }
    }
  }

  await prisma.$transaction([
    prisma.directMessageAttachment.deleteMany({
      where: { messageId },
    }),
    prisma.directMessage.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        body: "",
        gifUrl: null,
        editedAt: null,
      },
    }),
  ]);
}

export async function markDirectConversationRead(conversationId: string) {
  const session = await requireDirectChatSession();
  await assertDirectConversationMember(conversationId, session.user.id);
  await prisma.directConversationMember.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
    data: { lastReadAt: new Date() },
  });
}

export async function fetchDirectChatInbox() {
  const session = await requireDirectChatSession();
  return loadDirectChatInbox(session.user.id);
}

export async function fetchDirectChatEligibleUsers() {
  const session = await requireDirectChatSession();
  return listDirectChatEligibleUsers(session.user.id);
}

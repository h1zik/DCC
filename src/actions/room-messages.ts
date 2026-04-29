"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { assertRoomMember } from "@/lib/room-access";
import { assertSafeGifUrl } from "@/lib/room-chat-gif";
import {
  isWhatsAppConfigured,
  normalizeWhatsAppE164,
  sendWhatsAppMessage,
} from "@/lib/whatsapp-gateway";
import {
  mapRoomMessageToView,
  roomChatMessageInclude,
  type RoomChatMessageView,
} from "@/lib/room-chat-message-view";
import { sendWebPushMessage } from "@/lib/web-push";

const sendMessageSchema = z.object({
  roomId: z.string().min(1),
  body: z.string().max(4000),
  gifUrl: z.string().max(2048).optional(),
  replyToId: z.string().min(1).optional(),
});

type RoomMentionCandidate = {
  id: string;
  name: string | null;
  email: string;
  whatsappPhone: string | null;
};

function normalizeMentionToken(v: string): string {
  return v.trim().toLowerCase();
}

/** Ambil token mention ala @umar / @umar.dev dari body. */
function extractMentionTokens(body: string): string[] {
  const matches = body.matchAll(/(^|[\s(])@([a-zA-Z0-9._-]{2,40})/g);
  const set = new Set<string>();
  for (const m of matches) {
    const token = normalizeMentionToken(m[2] ?? "");
    if (token) set.add(token);
  }
  return [...set];
}

/** Alias mention untuk user: @namaDepan, @namaLengkapNoSpasi, @emailLocalPart */
function mentionAliasesForUser(user: RoomMentionCandidate): string[] {
  const aliases = new Set<string>();
  const add = (v: string) => {
    const t = normalizeMentionToken(v);
    if (t) aliases.add(t);
  };

  const name = user.name?.trim() ?? "";
  if (name) {
    add(name);
    add(name.replace(/\s+/g, ""));
    for (const part of name.split(/\s+/)) add(part);
  }

  const localPart = user.email.split("@")[0] ?? "";
  if (localPart) add(localPart);
  return [...aliases];
}

async function notifyMentionedUsersViaWhatsApp(params: {
  roomId: string;
  roomName: string;
  body: string;
  authorId: string;
  authorName: string;
}) {
  if (!isWhatsAppConfigured()) return;
  const tokens = extractMentionTokens(params.body);
  if (tokens.length === 0) return;

  const members = await prisma.roomMember.findMany({
    where: { roomId: params.roomId },
    select: {
      user: {
        select: { id: true, name: true, email: true, whatsappPhone: true },
      },
    },
  });

  const users = members.map((m) => m.user);
  const recipients = new Map<string, RoomMentionCandidate>();
  for (const token of tokens) {
    const found = users.find((u) => mentionAliasesForUser(u).includes(token));
    if (!found || found.id === params.authorId) continue;
    recipients.set(found.id, found);
  }
  if (recipients.size === 0) return;

  const sender = params.authorName.trim() || "Rekan tim";
  const roomLabel = params.roomName.trim() || "ruang kerja";
  const waText = [
    `🧙 KAMU TELAH DI SUMMON ${sender.toUpperCase()}.`,
    "BUKA DCC SEKARANG 😈",
    "",
    `Ruang: ${roomLabel}`,
  ].join("\n");

  await Promise.all(
    [...recipients.values()].map(async (u) => {
      const phone = normalizeWhatsAppE164(u.whatsappPhone);
      if (!phone) return;
      try {
        await sendWhatsAppMessage({ toE164: phone, message: waText });
      } catch (e) {
        console.error("[room-chat] mention whatsapp failed", {
          roomId: params.roomId,
          userId: u.id,
          error: e,
        });
      }
    }),
  );
}

async function notifyRoomMembersViaPush(params: {
  roomId: string;
  roomName: string;
  authorId: string;
  authorName: string;
  body: string;
  hasGif: boolean;
}) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId: {
        in: (
          await prisma.roomMember.findMany({
            where: {
              roomId: params.roomId,
              userId: { not: params.authorId },
            },
            select: { userId: true },
          })
        ).map((m) => m.userId),
      },
    },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });
  if (subscriptions.length === 0) return;
  const preview = params.body.trim();
  const snippet = preview
    ? preview.length > 90
      ? `${preview.slice(0, 90)}…`
      : preview
    : params.hasGif
      ? "Mengirim GIF"
      : "Pesan baru";
  const sender = params.authorName.trim() || "Rekan tim";
  const roomLabel = params.roomName.trim() || "ruangan";
  const invalidSubscriptionIds: string[] = [];
  await Promise.all(
    subscriptions.map(async (sub) => {
      const sent = await sendWebPushMessage({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        payload: {
          title: `${sender} di ${roomLabel}`,
          body: snippet,
          url: `/room/${params.roomId}/chat`,
        },
      });
      if (!sent.ok && sent.reason === "gone") {
        invalidSubscriptionIds.push(sub.id);
      } else if (!sent.ok) {
        console.error("[room-chat] push send failed", {
          roomId: params.roomId,
          subscriptionId: sub.id,
          reason: sent.reason,
          statusCode: sent.statusCode ?? null,
        });
      }
    }),
  );
  if (invalidSubscriptionIds.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: invalidSubscriptionIds } },
    });
  }
}

export async function addRoomMessage(
  input: z.infer<typeof sendMessageSchema>,
): Promise<RoomChatMessageView> {
  const session = await requireTasksRoomHubSession();
  const data = sendMessageSchema.parse(input);
  const body = data.body.trim();
  const gifRaw = (data.gifUrl ?? "").trim();
  const gifUrl = gifRaw ? assertSafeGifUrl(gifRaw) : null;
  const replyToId = (data.replyToId ?? "").trim() || null;

  if (!body && !gifUrl) {
    throw new Error("Tulis pesan, pilih GIF, atau keduanya.");
  }

  await assertRoomMember(data.roomId, session.user.id);
  const room = await prisma.room.findUniqueOrThrow({
    where: { id: data.roomId },
    select: { id: true, name: true },
  });

  if (replyToId) {
    const parent = await prisma.roomMessage.findFirst({
      where: { id: replyToId, roomId: data.roomId },
      select: { id: true },
    });
    if (!parent) {
      throw new Error("Pesan yang dibalas tidak ditemukan.");
    }
  }

  const created = await prisma.roomMessage.create({
    data: {
      roomId: data.roomId,
      authorId: session.user.id,
      body,
      gifUrl,
      replyToId,
    },
    include: roomChatMessageInclude,
  });
  await notifyMentionedUsersViaWhatsApp({
    roomId: room.id,
    roomName: room.name,
    body,
    authorId: session.user.id,
    authorName: session.user.name || session.user.email || "Rekan tim",
  });
  await notifyRoomMembersViaPush({
    roomId: room.id,
    roomName: room.name,
    authorId: session.user.id,
    authorName: session.user.name || session.user.email || "Rekan tim",
    body,
    hasGif: Boolean(gifUrl),
  });
  revalidateTasksAndRoomHub();
  return mapRoomMessageToView(created);
}

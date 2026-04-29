"use server";

import { z } from "zod";
import { NotificationType } from "@prisma/client";
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

async function notifyRoomMembersInApp(params: {
  roomId: string;
  roomName: string;
  authorId: string;
  authorName: string;
  body: string;
  hasGif: boolean;
}) {
  const members = await prisma.roomMember.findMany({
    where: {
      roomId: params.roomId,
      userId: { not: params.authorId },
    },
    select: { userId: true },
  });
  if (members.length === 0) return;
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
  const message = `[Chat ${roomLabel}] ${sender}: ${snippet}`;
  await prisma.notification.createMany({
    data: members.map((m) => ({
      userId: m.userId,
      message,
      type: NotificationType.SCHEDULE_REMINDER,
    })),
  });
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
  await notifyRoomMembersInApp({
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

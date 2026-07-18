"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { assertRoomHubManager, assertRoomMember } from "@/lib/room-access";
import {
  ensureRoomDefaultChannel,
  listRoomChannelsForUser,
  markRoomChannelRead,
  normalizeChannelName,
  type RoomChannelView,
} from "@/lib/room-channels";

const createChannelSchema = z.object({
  roomId: z.string().min(1),
  name: z.string().min(1).max(80),
  topic: z.string().max(200).optional(),
  type: z.enum(["TEXT", "VOICE"]).optional(),
  isLocked: z.boolean().optional(),
});

const setChannelLockSchema = z.object({
  channelId: z.string().min(1),
  locked: z.boolean(),
});

const renameChannelSchema = z.object({
  channelId: z.string().min(1),
  name: z.string().min(1).max(80),
  topic: z.string().max(200).optional(),
});

/** Daftar channel + unread untuk ruangan (dipakai polling sidebar). */
export async function listRoomChannels(
  roomId: string,
): Promise<RoomChannelView[]> {
  const session = await requireTasksRoomHubSession();
  await assertRoomMember(roomId, session.user.id);
  return listRoomChannelsForUser(roomId, session.user.id);
}

export async function createRoomChannel(
  input: z.infer<typeof createChannelSchema>,
): Promise<RoomChannelView> {
  const session = await requireTasksRoomHubSession();
  const data = createChannelSchema.parse(input);
  await assertRoomHubManager(data.roomId, session.user.id);

  const name = normalizeChannelName(data.name);
  if (!name) throw new Error("Nama channel tidak valid.");

  const topic = data.topic?.trim() || null;

  const duplicate = await prisma.roomChannel.findFirst({
    where: { roomId: data.roomId, name },
    select: { id: true },
  });
  if (duplicate) throw new Error(`Channel #${name} sudah ada.`);

  const last = await prisma.roomChannel.findFirst({
    where: { roomId: data.roomId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? 0) + 1;

  const created = await prisma.roomChannel.create({
    data: {
      roomId: data.roomId,
      name,
      topic,
      type: data.type ?? "TEXT",
      sortOrder,
      // Channel default selalu TEXT — channel baru (termasuk VOICE) tidak
      // pernah menjadi default.
      isDefault: false,
      isLocked: data.isLocked === true,
    },
    select: {
      id: true,
      name: true,
      topic: true,
      type: true,
      isDefault: true,
      isLocked: true,
      sortOrder: true,
    },
  });

  revalidateTasksAndRoomHub();
  return { ...created, unreadCount: 0 };
}

export async function renameRoomChannel(
  input: z.infer<typeof renameChannelSchema>,
): Promise<void> {
  const session = await requireTasksRoomHubSession();
  const data = renameChannelSchema.parse(input);

  const channel = await prisma.roomChannel.findUniqueOrThrow({
    where: { id: data.channelId },
    select: { id: true, roomId: true, isDefault: true },
  });
  await assertRoomHubManager(channel.roomId, session.user.id);

  const name = normalizeChannelName(data.name);
  if (!name) throw new Error("Nama channel tidak valid.");
  const topic = data.topic?.trim() || null;

  const duplicate = await prisma.roomChannel.findFirst({
    where: { roomId: channel.roomId, name, id: { not: channel.id } },
    select: { id: true },
  });
  if (duplicate) throw new Error(`Channel #${name} sudah ada.`);

  await prisma.roomChannel.update({
    where: { id: channel.id },
    data: { name, topic },
  });
  revalidateTasksAndRoomHub();
}

export async function deleteRoomChannel(channelId: string): Promise<string> {
  const session = await requireTasksRoomHubSession();
  const channel = await prisma.roomChannel.findUniqueOrThrow({
    where: { id: channelId },
    select: { id: true, roomId: true, isDefault: true, isLocked: true },
  });
  await assertRoomHubManager(channel.roomId, session.user.id);

  if (channel.isDefault || channel.isLocked) {
    throw new Error("Channel terkunci tidak dapat dihapus.");
  }

  await prisma.roomChannel.delete({ where: { id: channel.id } });
  const fallbackChannelId = await ensureRoomDefaultChannel(channel.roomId);
  revalidateTasksAndRoomHub();
  return fallbackChannelId;
}

export async function setRoomChannelLocked(
  input: z.infer<typeof setChannelLockSchema>,
): Promise<void> {
  const session = await requireTasksRoomHubSession();
  const data = setChannelLockSchema.parse(input);

  const channel = await prisma.roomChannel.findUniqueOrThrow({
    where: { id: data.channelId },
    select: { id: true, roomId: true, isDefault: true },
  });
  await assertRoomHubManager(channel.roomId, session.user.id);

  if (channel.isDefault && !data.locked) {
    throw new Error("Channel default selalu terkunci.");
  }

  await prisma.roomChannel.update({
    where: { id: channel.id },
    data: { isLocked: data.locked },
  });
  revalidateTasksAndRoomHub();
}

export async function markRoomChannelReadAction(
  channelId: string,
): Promise<void> {
  const session = await requireTasksRoomHubSession();
  const channel = await prisma.roomChannel.findUniqueOrThrow({
    where: { id: channelId },
    select: { roomId: true },
  });
  await assertRoomMember(channel.roomId, session.user.id);
  await markRoomChannelRead(channelId, session.user.id);
}

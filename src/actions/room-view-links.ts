"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";

async function ensureLinksMember(viewId: string, userId: string) {
  const v = await prisma.roomView.findUniqueOrThrow({
    where: { id: viewId },
    select: { roomId: true, type: true },
  });
  if (v.type !== "LINKS") throw new Error("View bukan tipe Hub Tautan.");
  await assertRoomMember(v.roomId, userId);
  return v.roomId;
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("URL wajib diisi.");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const upsertSchema = z.object({
  id: z.string().optional(),
  viewId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  url: z.string().trim().min(1).max(800),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
});

export async function upsertRoomLinkItem(input: z.infer<typeof upsertSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = upsertSchema.parse(input);
  const roomId = await ensureLinksMember(data.viewId, session.user.id);
  const url = normalizeUrl(data.url);

  if (data.id) {
    await prisma.roomLinkItem.update({
      where: { id: data.id },
      data: {
        title: data.title,
        url,
        description: data.description?.trim() || null,
        category: data.category?.trim() || null,
      },
    });
  } else {
    const max = await prisma.roomLinkItem.aggregate({
      where: { viewId: data.viewId },
      _max: { sortOrder: true },
    });
    await prisma.roomLinkItem.create({
      data: {
        viewId: data.viewId,
        title: data.title,
        url,
        description: data.description?.trim() || null,
        category: data.category?.trim() || null,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  }
  revalidatePath(`/room/${roomId}/view/${data.viewId}`);
}

export async function deleteRoomLinkItem(linkId: string) {
  const session = await requireTasksRoomHubSession();
  const l = await prisma.roomLinkItem.findUniqueOrThrow({
    where: { id: linkId },
    select: { viewId: true },
  });
  const roomId = await ensureLinksMember(l.viewId, session.user.id);
  await prisma.roomLinkItem.delete({ where: { id: linkId } });
  revalidatePath(`/room/${roomId}/view/${l.viewId}`);
}

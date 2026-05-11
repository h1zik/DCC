"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";

async function ensureWikiMember(viewId: string, userId: string) {
  const v = await prisma.roomView.findUniqueOrThrow({
    where: { id: viewId },
    select: { roomId: true, type: true },
  });
  if (v.type !== "WIKI") throw new Error("View bukan tipe Wiki.");
  await assertRoomMember(v.roomId, userId);
  return v.roomId;
}

const upsertSchema = z.object({
  id: z.string().optional(),
  viewId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  content: z.string().max(50_000).optional().default(""),
});

export async function upsertRoomWikiPage(input: z.infer<typeof upsertSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = upsertSchema.parse(input);
  const roomId = await ensureWikiMember(data.viewId, session.user.id);

  let pageId = data.id;
  if (pageId) {
    await prisma.roomWikiPage.update({
      where: { id: pageId },
      data: {
        title: data.title,
        content: data.content ?? "",
        updatedById: session.user.id,
      },
    });
  } else {
    const max = await prisma.roomWikiPage.aggregate({
      where: { viewId: data.viewId },
      _max: { sortOrder: true },
    });
    const created = await prisma.roomWikiPage.create({
      data: {
        viewId: data.viewId,
        title: data.title,
        content: data.content ?? "",
        updatedById: session.user.id,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
    pageId = created.id;
  }
  revalidatePath(`/room/${roomId}/view/${data.viewId}`);
  return { id: pageId };
}

export async function deleteRoomWikiPage(pageId: string) {
  const session = await requireTasksRoomHubSession();
  const p = await prisma.roomWikiPage.findUniqueOrThrow({
    where: { id: pageId },
    select: { viewId: true },
  });
  const roomId = await ensureWikiMember(p.viewId, session.user.id);
  await prisma.roomWikiPage.delete({ where: { id: pageId } });
  revalidatePath(`/room/${roomId}/view/${p.viewId}`);
}

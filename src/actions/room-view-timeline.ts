"use server";

import { revalidatePath } from "next/cache";
import { RoomTimelineStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";

async function ensureTimelineMember(viewId: string, userId: string) {
  const v = await prisma.roomView.findUniqueOrThrow({
    where: { id: viewId },
    select: { roomId: true, type: true },
  });
  if (v.type !== "TIMELINE") throw new Error("View bukan tipe Linimasa.");
  await assertRoomMember(v.roomId, userId);
  return v.roomId;
}

const upsertSchema = z.object({
  id: z.string().optional(),
  viewId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  date: z.coerce.date(),
  status: z.nativeEnum(RoomTimelineStatus).default(RoomTimelineStatus.UPCOMING),
});

export async function upsertRoomTimelineMilestone(
  input: z.infer<typeof upsertSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = upsertSchema.parse(input);
  const roomId = await ensureTimelineMember(data.viewId, session.user.id);

  if (data.id) {
    await prisma.roomTimelineMilestone.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description?.trim() || null,
        date: data.date,
        status: data.status,
      },
    });
  } else {
    const max = await prisma.roomTimelineMilestone.aggregate({
      where: { viewId: data.viewId },
      _max: { sortOrder: true },
    });
    await prisma.roomTimelineMilestone.create({
      data: {
        viewId: data.viewId,
        title: data.title,
        description: data.description?.trim() || null,
        date: data.date,
        status: data.status,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  }
  revalidatePath(`/room/${roomId}/view/${data.viewId}`);
}

export async function deleteRoomTimelineMilestone(milestoneId: string) {
  const session = await requireTasksRoomHubSession();
  const m = await prisma.roomTimelineMilestone.findUniqueOrThrow({
    where: { id: milestoneId },
    select: { viewId: true },
  });
  const roomId = await ensureTimelineMember(m.viewId, session.user.id);
  await prisma.roomTimelineMilestone.delete({ where: { id: milestoneId } });
  revalidatePath(`/room/${roomId}/view/${m.viewId}`);
}

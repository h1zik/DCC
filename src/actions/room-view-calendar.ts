"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";

async function ensureCalendarViewMember(viewId: string, userId: string) {
  const v = await prisma.roomView.findUniqueOrThrow({
    where: { id: viewId },
    select: { roomId: true, type: true },
  });
  if (v.type !== "CALENDAR") throw new Error("View bukan tipe Kalender.");
  await assertRoomMember(v.roomId, userId);
  return v.roomId;
}

const upsertSchema = z.object({
  id: z.string().optional(),
  viewId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
  allDay: z.boolean().optional().default(false),
});

export async function upsertRoomCalendarEvent(input: z.infer<typeof upsertSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = upsertSchema.parse(input);
  const roomId = await ensureCalendarViewMember(data.viewId, session.user.id);

  if (data.endsAt && data.endsAt.getTime() < data.startsAt.getTime()) {
    throw new Error("Jam selesai tidak boleh sebelum jam mulai.");
  }

  if (data.id) {
    await prisma.roomCalendarEvent.update({
      where: { id: data.id },
      data: {
        title: data.title,
        description: data.description?.trim() || null,
        location: data.location?.trim() || null,
        startsAt: data.startsAt,
        endsAt: data.endsAt ?? null,
        allDay: data.allDay,
      },
    });
  } else {
    await prisma.roomCalendarEvent.create({
      data: {
        viewId: data.viewId,
        title: data.title,
        description: data.description?.trim() || null,
        location: data.location?.trim() || null,
        startsAt: data.startsAt,
        endsAt: data.endsAt ?? null,
        allDay: data.allDay ?? false,
        createdById: session.user.id,
      },
    });
  }
  revalidatePath(`/room/${roomId}/view/${data.viewId}`);
}

export async function deleteRoomCalendarEvent(eventId: string) {
  const session = await requireTasksRoomHubSession();
  const ev = await prisma.roomCalendarEvent.findUniqueOrThrow({
    where: { id: eventId },
    select: { viewId: true },
  });
  const roomId = await ensureCalendarViewMember(ev.viewId, session.user.id);
  await prisma.roomCalendarEvent.delete({ where: { id: eventId } });
  revalidatePath(`/room/${roomId}/view/${ev.viewId}`);
}

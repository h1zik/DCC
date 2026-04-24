"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  startsAt: z.coerce.date(),
  participantUserIds: z.array(z.string().min(1)).min(1).max(200),
});

const updateSchema = createSchema.extend({
  eventId: z.string().min(1),
});

const deleteSchema = z.object({
  eventId: z.string().min(1),
});

function assertFuture(startsAt: Date) {
  if (startsAt.getTime() < Date.now() - 60_000) {
    throw new Error("Waktu mulai tidak boleh di masa lalu.");
  }
}

export async function createScheduleEvent(input: z.infer<typeof createSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  const data = createSchema.parse(input);
  assertFuture(data.startsAt);

  const uniq = [...new Set(data.participantUserIds)];
  const users = await prisma.user.findMany({
    where: { id: { in: uniq } },
    select: { id: true },
  });
  if (users.length !== uniq.length) {
    throw new Error("Ada peserta yang tidak valid.");
  }

  await prisma.scheduleEvent.create({
    data: {
      title: data.title.trim(),
      description: data.description?.trim() || null,
      location: data.location?.trim() || null,
      startsAt: data.startsAt,
      createdById: session.user.id,
      participants: {
        create: uniq.map((userId) => ({ userId })),
      },
    },
  });
  revalidatePath("/schedule");
}

export async function updateScheduleEvent(input: z.infer<typeof updateSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  const data = updateSchema.parse(input);
  assertFuture(data.startsAt);

  const event = await prisma.scheduleEvent.findUnique({
    where: { id: data.eventId },
    select: { id: true, createdById: true },
  });
  if (!event) throw new Error("Jadwal tidak ditemukan.");
  const canEdit =
    session.user.role === UserRole.CEO || event.createdById === session.user.id;
  if (!canEdit) throw new Error("Anda tidak dapat mengubah jadwal ini.");

  const uniq = [...new Set(data.participantUserIds)];
  const users = await prisma.user.findMany({
    where: { id: { in: uniq } },
    select: { id: true },
  });
  if (users.length !== uniq.length) {
    throw new Error("Ada peserta yang tidak valid.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.scheduleEventParticipant.deleteMany({
      where: { eventId: event.id },
    });
    await tx.scheduleReminderSent.deleteMany({
      where: { eventId: event.id },
    });
    await tx.scheduleEvent.update({
      where: { id: event.id },
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        location: data.location?.trim() || null,
        startsAt: data.startsAt,
        participants: {
          create: uniq.map((userId) => ({ userId })),
        },
      },
    });
  });
  revalidatePath("/schedule");
}

export async function deleteScheduleEvent(input: z.infer<typeof deleteSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  const data = deleteSchema.parse(input);

  const event = await prisma.scheduleEvent.findUnique({
    where: { id: data.eventId },
    select: { id: true, createdById: true },
  });
  if (!event) throw new Error("Jadwal tidak ditemukan.");
  const canDelete =
    session.user.role === UserRole.CEO || event.createdById === session.user.id;
  if (!canDelete) throw new Error("Anda tidak dapat menghapus jadwal ini.");

  await prisma.scheduleEvent.delete({ where: { id: event.id } });
  revalidatePath("/schedule");
}

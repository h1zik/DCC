"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NotificationType, ScheduleRecurrence, UserRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import {
  isWhatsAppConfigured,
  normalizeWhatsAppE164,
  sendWhatsAppMessage,
} from "@/lib/whatsapp-gateway";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  startsAt: z.coerce.date(),
  participantUserIds: z.array(z.string().min(1)).min(1).max(200),
  recurrence: z.nativeEnum(ScheduleRecurrence).default(ScheduleRecurrence.NONE),
  recurrenceUntil: z.coerce.date().optional().nullable(),
});

const updateSchema = z.object({
  eventId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  startsAt: z.coerce.date(),
  participantUserIds: z.array(z.string().min(1)).min(1).max(200),
  recurrence: z.nativeEnum(ScheduleRecurrence).optional(),
  recurrenceUntil: z.coerce.date().optional().nullable(),
  applyTo: z.enum(["SINGLE", "SERIES"]).default("SINGLE"),
});

const deleteSchema = z.object({
  eventId: z.string().min(1),
});

const bulkDeleteSchema = z.object({
  eventIds: z.array(z.string().min(1)).min(1).max(500),
});

function assertFuture(startsAt: Date) {
  if (startsAt.getTime() < Date.now() - 60_000) {
    throw new Error("Waktu mulai tidak boleh di masa lalu.");
  }
}

function formatWhen(d: Date): string {
  return d.toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
}

function addMonthsKeepingDay(source: Date, monthsToAdd: number): Date {
  const next = new Date(source);
  const wantedDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + monthsToAdd);
  const end = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(wantedDay, end));
  return next;
}

function buildRecurrenceStarts(input: {
  startsAt: Date;
  recurrence: ScheduleRecurrence;
  recurrenceUntil?: Date | null;
}): Date[] {
  if (input.recurrence === ScheduleRecurrence.NONE) return [input.startsAt];
  if (!input.recurrenceUntil) {
    throw new Error("Tanggal selesai pengulangan wajib diisi.");
  }
  if (input.recurrenceUntil.getTime() < input.startsAt.getTime()) {
    throw new Error("Tanggal selesai pengulangan harus setelah waktu mulai.");
  }

  const MAX_OCCURRENCES = 120;
  const starts: Date[] = [];
  let cursor = new Date(input.startsAt);
  while (cursor.getTime() <= input.recurrenceUntil.getTime()) {
    starts.push(new Date(cursor));
    if (starts.length > MAX_OCCURRENCES) {
      throw new Error("Pengulangan terlalu banyak (maksimal 120 jadwal).");
    }
    if (input.recurrence === ScheduleRecurrence.DAILY) {
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
      continue;
    }
    if (input.recurrence === ScheduleRecurrence.WEEKLY) {
      cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
      continue;
    }
    cursor = addMonthsKeepingDay(cursor, 1);
  }
  return starts;
}

async function notifyScheduleUsers(params: {
  userIds: string[];
  message: string;
}): Promise<void> {
  const uniq = [...new Set(params.userIds)];
  if (uniq.length === 0) return;
  await Promise.all(
    uniq.map((userId) =>
      notifyUser(userId, params.message, NotificationType.SCHEDULE_REMINDER),
    ),
  );
  if (!isWhatsAppConfigured()) return;
  const users = await prisma.user.findMany({
    where: { id: { in: uniq } },
    select: { id: true, name: true, whatsappPhone: true },
  });
  await Promise.all(
    users.map(async (u) => {
      const phone = normalizeWhatsAppE164(u.whatsappPhone);
      if (!phone) return;
      const name = u.name?.trim() || "Rekan";
      try {
        await sendWhatsAppMessage({
          toE164: phone,
          message: `Halo ${name},\n\n${params.message}`,
        });
      } catch (err) {
        console.error("[schedule] whatsapp notify failed", err);
      }
    }),
  );
}

export async function createScheduleEvent(input: z.infer<typeof createSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  const data = createSchema.parse(input);
  assertFuture(data.startsAt);
  if (data.recurrence !== ScheduleRecurrence.NONE && !data.recurrenceUntil) {
    throw new Error("Tanggal selesai pengulangan wajib diisi.");
  }

  const uniq = [...new Set(data.participantUserIds)];
  const users = await prisma.user.findMany({
    where: { id: { in: uniq } },
    select: { id: true, name: true, whatsappPhone: true },
  });
  if (users.length !== uniq.length) {
    throw new Error("Ada peserta yang tidak valid.");
  }

  const startsList = buildRecurrenceStarts({
    startsAt: data.startsAt,
    recurrence: data.recurrence,
    recurrenceUntil: data.recurrenceUntil,
  });
  const seriesId =
    data.recurrence === ScheduleRecurrence.NONE ? null : randomUUID();
  const title = data.title.trim();
  const description = data.description?.trim() || null;
  const location = data.location?.trim() || null;
  const created = await prisma.$transaction(async (tx) => {
    const rows = await Promise.all(
      startsList.map((startsAt) =>
        tx.scheduleEvent.create({
          data: {
            title,
            description,
            location,
            startsAt,
            recurrence: data.recurrence,
            recurrenceUntil: data.recurrenceUntil ?? null,
            seriesId,
            createdById: session.user.id,
            participants: {
              create: uniq.map((userId) => ({ userId })),
            },
          },
        }),
      ),
    );
    return rows;
  });

  // Notifikasi langsung saat jadwal dibuat.
  const first = created[0];
  const loc = first.location?.trim() ? ` · ${first.location.trim()}` : "";
  const recurrenceLabel =
    created.length > 1
      ? `\n🔁 Berulang: ${created.length} kali sampai ${formatWhen(created[created.length - 1].startsAt)}`
      : "";
  const msg =
    `📅 Jadwal baru: ${first.title}\n🕒 Mulai: ${formatWhen(first.startsAt)}${loc}` +
    recurrenceLabel;
  await notifyScheduleUsers({ userIds: uniq, message: msg });
  revalidatePath("/schedule");
}

export async function updateScheduleEvent(input: z.infer<typeof updateSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  const data = updateSchema.parse(input);
  assertFuture(data.startsAt);

  const event = await prisma.scheduleEvent.findUnique({
    where: { id: data.eventId },
    select: {
      id: true,
      createdById: true,
      seriesId: true,
      recurrence: true,
      recurrenceUntil: true,
    },
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

  const prev = await prisma.scheduleEvent.findUnique({
    where: { id: event.id },
    select: {
      title: true,
      startsAt: true,
      location: true,
      participants: { select: { userId: true } },
    },
  });

  if (data.applyTo === "SERIES") {
    const targetSeriesId = event.seriesId;
    if (!targetSeriesId || event.recurrence === ScheduleRecurrence.NONE) {
      throw new Error("Jadwal ini bukan bagian dari pengulangan.");
    }
    const nextRecurrence = data.recurrence ?? event.recurrence;
    const nextRecurrenceUntil =
      data.recurrenceUntil === undefined
        ? event.recurrenceUntil
        : data.recurrenceUntil;
    const startsList = buildRecurrenceStarts({
      startsAt: data.startsAt,
      recurrence: nextRecurrence,
      recurrenceUntil: nextRecurrenceUntil ?? null,
    });
    const title = data.title.trim();
    const description = data.description?.trim() || null;
    const location = data.location?.trim() || null;

    const { updatedRows, oldParticipantIds } = await prisma.$transaction(async (tx) => {
      const existingRows = await tx.scheduleEvent.findMany({
        where: { seriesId: targetSeriesId },
        select: {
          id: true,
          participants: { select: { userId: true } },
        },
      });
      const oldParticipantIds = [
        ...new Set(
          existingRows.flatMap((row) => row.participants.map((p) => p.userId)),
        ),
      ];
      const existingIds = existingRows.map((row) => row.id);
      if (existingIds.length > 0) {
        await tx.scheduleReminderSent.deleteMany({
          where: { eventId: { in: existingIds } },
        });
        await tx.scheduleEventParticipant.deleteMany({
          where: { eventId: { in: existingIds } },
        });
        await tx.scheduleEvent.deleteMany({ where: { id: { in: existingIds } } });
      }
      const updatedRows = await Promise.all(
        startsList.map((startsAt) =>
          tx.scheduleEvent.create({
            data: {
              title,
              description,
              location,
              startsAt,
              recurrence: nextRecurrence,
              recurrenceUntil: nextRecurrenceUntil ?? null,
              seriesId: targetSeriesId,
              createdById: event.createdById,
              participants: {
                create: uniq.map((userId) => ({ userId })),
              },
            },
          }),
        ),
      );
      return { updatedRows, oldParticipantIds };
    });
    const first = updatedRows[0];
    const last = updatedRows[updatedRows.length - 1];
    const loc = first.location?.trim() ? ` · ${first.location.trim()}` : "";
    const msg =
      `🔄 Jadwal pengulangan diperbarui: ${first.title}\n` +
      `🕒 Mulai: ${formatWhen(first.startsAt)}${loc}\n` +
      `🔁 Total: ${updatedRows.length} kali sampai ${formatWhen(last.startsAt)}`;
    await notifyScheduleUsers({
      userIds: [...new Set([...oldParticipantIds, ...uniq])],
      message: msg,
    });
    revalidatePath("/schedule");
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.scheduleEventParticipant.deleteMany({
      where: { eventId: event.id },
    });
    await tx.scheduleReminderSent.deleteMany({
      where: { eventId: event.id },
    });
    return tx.scheduleEvent.update({
      where: { id: event.id },
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        location: data.location?.trim() || null,
        startsAt: data.startsAt,
        recurrence: event.recurrence,
        recurrenceUntil: event.recurrenceUntil,
        seriesId: event.seriesId,
        participants: {
          create: uniq.map((userId) => ({ userId })),
        },
      },
    });
  });
  const oldLoc = prev?.location?.trim() ? ` · ${prev.location.trim()}` : "";
  const newLoc = updated.location?.trim() ? ` · ${updated.location.trim()}` : "";
  const msg =
    `🔄 Jadwal diperbarui: ${updated.title}\n` +
    `⏮️ Sebelumnya: ${prev ? formatWhen(prev.startsAt) : "-"}${oldLoc}\n` +
    `⏭️ Menjadi: ${formatWhen(updated.startsAt)}${newLoc}`;
  await notifyScheduleUsers({
    userIds: [...new Set([...(prev?.participants.map((p) => p.userId) ?? []), ...uniq])],
    message: msg,
  });
  revalidatePath("/schedule");
}

export async function deleteScheduleEvent(input: z.infer<typeof deleteSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  const data = deleteSchema.parse(input);

  const event = await prisma.scheduleEvent.findUnique({
    where: { id: data.eventId },
    select: {
      id: true,
      createdById: true,
      title: true,
      startsAt: true,
      location: true,
      participants: { select: { userId: true } },
    },
  });
  if (!event) throw new Error("Jadwal tidak ditemukan.");
  const canDelete =
    session.user.role === UserRole.CEO || event.createdById === session.user.id;
  if (!canDelete) throw new Error("Anda tidak dapat menghapus jadwal ini.");

  await prisma.scheduleEvent.delete({ where: { id: event.id } });
  const loc = event.location?.trim() ? ` · ${event.location.trim()}` : "";
  await notifyScheduleUsers({
    userIds: event.participants.map((p) => p.userId),
    message: `❌ Jadwal dibatalkan: ${event.title}\n🕒 Sebelumnya: ${formatWhen(event.startsAt)}${loc}`,
  });
  revalidatePath("/schedule");
}

export async function deleteScheduleEventsBulk(
  input: z.infer<typeof bulkDeleteSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Belum masuk.");
  const data = bulkDeleteSchema.parse(input);
  const uniqIds = [...new Set(data.eventIds)];

  const events = await prisma.scheduleEvent.findMany({
    where: { id: { in: uniqIds } },
    select: {
      id: true,
      title: true,
      startsAt: true,
      createdById: true,
      participants: { select: { userId: true } },
    },
  });
  if (events.length !== uniqIds.length) {
    throw new Error("Sebagian jadwal tidak ditemukan.");
  }

  const unauthorized = events.some(
    (ev) =>
      session.user.role !== UserRole.CEO && ev.createdById !== session.user.id,
  );
  if (unauthorized) {
    throw new Error("Ada jadwal yang tidak bisa Anda hapus.");
  }

  await prisma.scheduleEvent.deleteMany({
    where: { id: { in: uniqIds } },
  });

  const allUsers = [
    ...new Set(events.flatMap((ev) => ev.participants.map((p) => p.userId))),
  ];
  const previewTitles = events
    .slice(0, 3)
    .map((ev) => ev.title)
    .join(", ");
  const more = events.length > 3 ? ` dan ${events.length - 3} lainnya` : "";
  await notifyScheduleUsers({
    userIds: allUsers,
    message: `❌ ${events.length} jadwal dibatalkan sekaligus.\n📝 ${previewTitles}${more}`,
  });

  revalidatePath("/schedule");
}

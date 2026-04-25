"use server";

import { revalidatePath } from "next/cache";
import { NotificationType, UserRole } from "@prisma/client";
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

function formatWhen(d: Date): string {
  return d.toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  });
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

  const uniq = [...new Set(data.participantUserIds)];
  const users = await prisma.user.findMany({
    where: { id: { in: uniq } },
    select: { id: true, name: true, whatsappPhone: true },
  });
  if (users.length !== uniq.length) {
    throw new Error("Ada peserta yang tidak valid.");
  }

  const created = await prisma.scheduleEvent.create({
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

  // Notifikasi langsung saat jadwal dibuat.
  const loc = created.location?.trim() ? ` · ${created.location.trim()}` : "";
  const msg = `📅 Jadwal baru: ${created.title}\n🕒 Mulai: ${formatWhen(created.startsAt)}${loc}`;
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

  const prev = await prisma.scheduleEvent.findUnique({
    where: { id: event.id },
    select: {
      title: true,
      startsAt: true,
      location: true,
      participants: { select: { userId: true } },
    },
  });

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

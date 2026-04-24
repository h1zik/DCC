import { NotificationType, ScheduleReminderKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

function formatWhen(d: Date): string {
  return d.toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * Kirim pengingat in-app untuk jadwal (H-1 ≈ 24 jam sebelum & ~1 jam sebelum).
 * Dipanggil dari cron terjadwal (mis. `/api/cron/task-sync`).
 */
export async function syncScheduleReminders(): Promise<void> {
  const now = new Date();
  const horizonEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const events = await prisma.scheduleEvent.findMany({
    where: {
      startsAt: {
        gt: now,
        lte: horizonEnd,
      },
    },
    include: {
      participants: { select: { userId: true } },
    },
  });

  const M = 60 * 1000;
  const H = 60 * M;
  const D = 24 * H;

  for (const ev of events) {
    const msUntil = ev.startsAt.getTime() - now.getTime();
    /** Jendela ~24 jam sebelum mulai (H-1). */
    const inDayWindow = msUntil >= 22 * D && msUntil <= 26 * D;
    /** Jendela ~1 jam sebelum mulai. */
    const inHourWindow = msUntil >= 40 * M && msUntil <= 80 * M;

    for (const p of ev.participants) {
      if (inDayWindow) {
        await trySendReminder(
          ev.id,
          p.userId,
          ScheduleReminderKind.DAY_BEFORE,
          `Besok: ${ev.title} — mulai ${formatWhen(ev.startsAt)}${suffixLocation(ev.location)}`,
        );
      }
      if (inHourWindow) {
        await trySendReminder(
          ev.id,
          p.userId,
          ScheduleReminderKind.HOUR_BEFORE,
          `±1 jam lagi: ${ev.title} — mulai ${formatWhen(ev.startsAt)}${suffixLocation(ev.location)}`,
        );
      }
    }
  }
}

function suffixLocation(loc: string | null): string {
  const t = loc?.trim();
  return t ? ` · ${t}` : "";
}

async function trySendReminder(
  eventId: string,
  userId: string,
  kind: ScheduleReminderKind,
  message: string,
): Promise<void> {
  const inserted = await prisma.scheduleReminderSent.createMany({
    data: [{ eventId, userId, kind }],
    skipDuplicates: true,
  });
  if (inserted.count === 0) return;
  await notifyUser(userId, message, NotificationType.SCHEDULE_REMINDER);
}

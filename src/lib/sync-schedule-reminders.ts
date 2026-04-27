import { NotificationType, ScheduleReminderKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";
import {
  isWhatsAppConfigured,
  normalizeWhatsAppE164,
  sendWhatsAppMessage,
} from "@/lib/whatsapp-gateway";

function formatWhen(d: Date): string {
  return d.toLocaleString("id-ID", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
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
      participants: {
        select: {
          userId: true,
          user: { select: { name: true, whatsappPhone: true } },
        },
      },
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
          p.user.name,
          p.user.whatsappPhone,
          ScheduleReminderKind.DAY_BEFORE,
          `📆 Besok: ${ev.title}\n🕒 Mulai: ${formatWhen(ev.startsAt)}${suffixLocation(ev.location)}`,
        );
      }
      if (inHourWindow) {
        await trySendReminder(
          ev.id,
          p.userId,
          p.user.name,
          p.user.whatsappPhone,
          ScheduleReminderKind.HOUR_BEFORE,
          `⏰ ±1 jam lagi: ${ev.title}\n🕒 Mulai: ${formatWhen(ev.startsAt)}${suffixLocation(ev.location)}`,
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
  userName: string | null,
  userWhatsappPhone: string | null,
  kind: ScheduleReminderKind,
  message: string,
): Promise<void> {
  const inserted = await prisma.scheduleReminderSent.createMany({
    data: [{ eventId, userId, kind }],
    skipDuplicates: true,
  });
  if (inserted.count === 0) return;
  await notifyUser(userId, message, NotificationType.SCHEDULE_REMINDER);
  if (isWhatsAppConfigured()) {
    const phone = normalizeWhatsAppE164(userWhatsappPhone);
    if (!phone) return;
    const name = userName?.trim() || "Rekan";
    try {
      await sendWhatsAppMessage({
        toE164: phone,
        message: `Halo ${name} 👋\n\n${message}`,
      });
    } catch (err) {
      console.error("[schedule] reminder whatsapp failed", err);
    }
  }
}

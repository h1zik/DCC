import { TaskStatus } from "@prisma/client";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { notifyPicDeadlineReminderViaWhatsApp } from "@/lib/task-whatsapp-notify";

function calendarDaysUntilDue(due: Date, from: Date = new Date()): number {
  return differenceInCalendarDays(startOfDay(due), startOfDay(from));
}

/**
 * Pengingat WhatsApp H-3 dan H-1 (kalender) untuk tugas aktif ber-PIC & ber-tenggat.
 * Panggil dari cron (`GET /api/cron/task-sync`), bukan dari load halaman — hindari beban berat di setiap request.
 */
export async function syncTaskDeadlineWhatsAppReminders() {
  const tasks = await prisma.task.findMany({
    where: {
      status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
      dueDate: { not: null },
      assignees: { some: {} },
      archivedAt: null,
    },
    include: {
      project: { include: { brand: true, room: { select: { name: true } } } },
      assignees: {
        include: {
          user: { select: { name: true, whatsappPhone: true } },
        },
      },
    },
  });

  const now = new Date();

  for (const t of tasks) {
    if (!t.dueDate || t.assignees.length === 0) continue;
    const days = calendarDaysUntilDue(t.dueDate, now);

    if (days === 3 && !t.whatsappReminder3dSentAt) {
      const sent = await Promise.all(
        t.assignees.map((a) =>
          notifyPicDeadlineReminderViaWhatsApp({
            assignee: a.user,
            whenLabel: "3 hari lagi",
            taskTitle: t.title,
            dueDate: t.dueDate!,
            project: t.project,
          }),
        ),
      );
      const ok = sent.some(Boolean);
      if (ok) {
        await prisma.task.update({
          where: { id: t.id },
          data: { whatsappReminder3dSentAt: new Date() },
        });
      }
    }

    if (days === 1 && !t.whatsappReminder1dSentAt) {
      const sent = await Promise.all(
        t.assignees.map((a) =>
          notifyPicDeadlineReminderViaWhatsApp({
            assignee: a.user,
            whenLabel: "Besok (1 hari lagi)",
            taskTitle: t.title,
            dueDate: t.dueDate!,
            project: t.project,
          }),
        ),
      );
      const ok = sent.some(Boolean);
      if (ok) {
        await prisma.task.update({
          where: { id: t.id },
          data: { whatsappReminder1dSentAt: new Date() },
        });
      }
    }
  }
}

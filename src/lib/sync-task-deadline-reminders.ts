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
      assigneeId: { not: null },
      archivedAt: null,
    },
    include: {
      project: { include: { brand: true, room: { select: { name: true } } } },
      assignee: { select: { name: true, whatsappPhone: true } },
    },
  });

  const now = new Date();

  for (const t of tasks) {
    if (!t.dueDate || !t.assignee) continue;
    const days = calendarDaysUntilDue(t.dueDate, now);

    if (days === 3 && !t.whatsappReminder3dSentAt) {
      const ok = await notifyPicDeadlineReminderViaWhatsApp({
        assignee: t.assignee,
        whenLabel: "3 hari lagi",
        taskTitle: t.title,
        dueDate: t.dueDate,
        project: t.project,
      });
      if (ok) {
        await prisma.task.update({
          where: { id: t.id },
          data: { whatsappReminder3dSentAt: new Date() },
        });
      }
    }

    if (days === 1 && !t.whatsappReminder1dSentAt) {
      const ok = await notifyPicDeadlineReminderViaWhatsApp({
        assignee: t.assignee,
        whenLabel: "Besok (1 hari lagi)",
        taskTitle: t.title,
        dueDate: t.dueDate,
        project: t.project,
      });
      if (ok) {
        await prisma.task.update({
          where: { id: t.id },
          data: { whatsappReminder1dSentAt: new Date() },
        });
      }
    }
  }
}
